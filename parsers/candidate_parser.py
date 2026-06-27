"""
Layer 2: Candidate Understanding
Converts raw candidate JSON into a structured profile that mirrors
how an experienced technical recruiter reads a CV.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import date

from utils.text_utils import normalize, contains_any, count_matches


# ------------------------------------------------------------------
# Consulting firm signals (penalize all-consulting careers)
# ------------------------------------------------------------------
CONSULTING_FIRMS = {
    "tcs", "tata consultancy", "tata consultancy services",
    "infosys", "wipro", "accenture", "cognizant", "capgemini",
    "hcl", "hcl technologies", "tech mahindra", "mphasis",
    "hexaware", "lti", "ltimindtree", "mindtree", "l&t infotech",
    "ibm", "deloitte", "kpmg", "ey", "ernst & young", "pwc",
    "igate", "niit technologies", "zensar", "mastech",
    "firstsource", "mecklermedia", "syntel",
}


def _is_consulting(company_name: str) -> bool:
    n = normalize(company_name)
    return any(firm in n for firm in CONSULTING_FIRMS)


# ------------------------------------------------------------------
# AI/ML-relevant skill tiers (for skill scoring, not semantic match)
# ------------------------------------------------------------------
SKILLS_TIER1 = {
    # Vector / retrieval stack
    "faiss", "pinecone", "weaviate", "qdrant", "milvus", "chroma",
    "opensearch", "elasticsearch", "vector database", "vector search",
    "sentence-transformers", "sentence transformers", "bge", "e5 embed",
    "dense retrieval", "hybrid retrieval", "bm25", "sparse retrieval",
    # Fine-tuning
    "lora", "qlora", "peft", "fine-tuning", "fine tuning",
    "instruction tuning", "rlhf",
    # Evaluation
    "ndcg", "map", "mrr", "precision@k", "recall@k", "a/b testing",
    "learning to rank", "lambdarank", "ranknet", "listwise ranking",
    # RAG / advanced
    "rag", "retrieval augmented generation", "re-ranking",
}

SKILLS_TIER2 = {
    "pytorch", "tensorflow", "transformers", "hugging face", "huggingface",
    "mlflow", "weights & biases", "wandb", "dvc",
    "nlp", "natural language processing", "text embedding",
    "python", "fastapi", "model serving", "triton", "torchserve",
    "mlops", "ml engineering", "recommendation system",
    "search engine", "information retrieval",
    "scikit-learn", "xgboost", "lightgbm", "catboost",
    "bert", "gpt", "llm", "large language model",
    "openai", "anthropic", "cohere",
}

SKILLS_TIER3 = {
    "sql", "spark", "kafka", "airflow", "docker", "kubernetes",
    "aws", "gcp", "azure", "redis", "postgresql", "mongodb",
    "data engineering", "feature engineering", "statistical modeling",
    "data science", "machine learning", "deep learning",
    "computer vision", "image classification",  # relevant but not core for this JD
    "speech recognition", "tts",  # less relevant
}

PROFICIENCY_WEIGHT = {
    "expert": 1.0, "advanced": 0.85, "intermediate": 0.65, "beginner": 0.35,
}

DURATION_WEIGHT = {
    36: 1.0, 12: 0.80, 6: 0.60, 0: 0.40,  # lower bound keys
}

def _proficiency_mult(p: str) -> float:
    return PROFICIENCY_WEIGHT.get(p.lower(), 0.5)

def _duration_mult(months: int) -> float:
    for threshold in (36, 12, 6, 0):
        if months >= threshold:
            return DURATION_WEIGHT[threshold]
    return 0.40


# ------------------------------------------------------------------
# Career description quality signals
# ------------------------------------------------------------------
PRODUCTION_TERMS = [
    "deployed", "production", "live", "serving", "endpoint", "api",
    "launched", "shipped", "rollout", "release", "a/b test",
    "real users", "in production", "prod", "served",
]
AI_TERMS = [
    "model", "ml ", "machine learning", "deep learning", "neural",
    "embedding", "training", "inference", "prediction", "retrieval",
    "ranking", "recommendation", "nlp", "llm", "transformer",
    "fine-tun", "rag", "vector", "faiss", "search engine",
]
SENIOR_TERMS = [
    "designed", "architected", "led", "owned", "drove", "built",
    "spearheaded", "founded", "principal", "staff", "tech lead",
    "mentored", "managed team", "cross-functional",
]
SCALE_TERMS = [
    "million", "billion", "scale", "high throughput", "low latency",
    "qps", "rps", "tps", "terabyte", "petabyte", "distributed",
]


# ------------------------------------------------------------------
# Education field scoring
# ------------------------------------------------------------------
CS_FIELDS = {
    "computer science", "computer engineering", "software engineering",
    "artificial intelligence", "machine learning", "data science",
    "information technology", "electronics", "electrical engineering",
    "mathematics", "statistics", "computational",
}

EDUCATION_TIER_SCORE = {
    "tier_1": 1.0, "tier_2": 0.75, "tier_3": 0.50, "tier_4": 0.30, "unknown": 0.40,
}


# ------------------------------------------------------------------
# Dataclass
# ------------------------------------------------------------------
@dataclass
class CandidateProfile:
    candidate_id: str

    # Profile basics
    current_title: str
    headline: str
    summary: str
    country: str
    location: str
    years_of_experience: float

    # Career history
    all_titles: List[str]
    all_companies: List[str]
    all_industries: List[str]
    career_descriptions_combined: str   # full text of all descriptions
    months_at_consulting: int
    months_at_product: int
    is_consulting_only: bool
    has_current_consulting_role: bool
    inferred_ai_ml_years: float
    has_production_ml: bool             # inferred from description text
    production_ml_evidence: List[str]

    # Skills
    all_skill_names: List[str]
    tier1_ai_skills: List[str]
    tier2_ai_skills: List[str]
    raw_skill_score: float              # weighted, before normalization

    # Education
    best_edu_tier: str
    best_edu_field: str
    education_score: float

    # Behavioral
    open_to_work: bool
    last_active_date: str
    days_since_active: int
    recruiter_response_rate: float
    avg_response_time_hours: float
    notice_period_days: int
    github_activity_score: float
    interview_completion_rate: float
    offer_acceptance_rate: float
    profile_completeness: float
    connection_count: int
    endorsements_received: int

    # Salary
    salary_min_lpa: float
    salary_max_lpa: float

    # Location
    in_india: bool
    in_preferred_city: bool
    willing_to_relocate: bool

    # Pre-computed signals
    is_honeypot: bool
    honeypot_reason: Optional[str]

    # Text used for embedding
    embedding_text: str

    # Raw data for explanation generation
    raw: dict


def parse(raw: dict) -> CandidateProfile:
    prof = raw.get("profile", {})
    career = raw.get("career_history", [])
    edu = raw.get("education", [])
    skills = raw.get("skills", [])
    sigs = raw.get("redrob_signals", {})

    cid = raw["candidate_id"]
    title = prof.get("current_title", "")
    headline = prof.get("headline", "")
    summary = prof.get("summary", "")
    country = prof.get("country", "")
    location = prof.get("location", "")
    yoe = float(prof.get("years_of_experience", 0))

    # ---- Career history analysis ----
    all_titles = [title] + [r.get("title", "") for r in career]
    all_companies = [prof.get("current_company", "")] + [r.get("company", "") for r in career]
    all_industries = [prof.get("current_industry", "")] + [r.get("industry", "") for r in career]

    months_consulting = 0
    months_product = 0
    for role in career:
        dur = role.get("duration_months", 0)
        if _is_consulting(role.get("company", "")):
            months_consulting += dur
        else:
            months_product += dur

    is_consulting_only = (
        months_consulting > 0
        and months_product == 0
        and all(_is_consulting(c) for c in all_companies if c)
    )
    has_current_consulting_role = _is_consulting(prof.get("current_company", ""))

    # ---- Descriptions ----
    descs = [r.get("description", "") for r in career if r.get("description")]
    career_descriptions_combined = " ".join(descs)
    desc_lower = career_descriptions_combined.lower()

    # Infer production ML exposure from description text
    prod_count = count_matches(desc_lower, PRODUCTION_TERMS)
    ai_count = count_matches(desc_lower, AI_TERMS)
    has_production_ml = prod_count >= 2 and ai_count >= 3
    production_ml_evidence = []
    if has_production_ml:
        for term in PRODUCTION_TERMS:
            if term in desc_lower:
                production_ml_evidence.append(term)

    # Infer approximate AI/ML years of experience
    ai_ml_months = 0
    for role in career:
        rdesc = role.get("description", "").lower()
        rtitle = role.get("title", "").lower()
        ai_in_title = contains_any(rtitle, ["ml", "ai", "data scien", "nlp", "machine learning",
                                             "deep learning", "research", "retrieval", "search"])
        ai_in_desc = count_matches(rdesc, AI_TERMS) >= 3
        if ai_in_title or ai_in_desc:
            ai_ml_months += role.get("duration_months", 0)
    inferred_ai_ml_years = ai_ml_months / 12.0

    # ---- Skills ----
    all_skill_names = [s["name"] for s in skills]
    skill_names_lower = [normalize(s["name"]) for s in skills]

    tier1_hits, tier2_hits = [], []
    raw_score = 0.0
    for sk in skills:
        name_n = normalize(sk["name"])
        p_mult = _proficiency_mult(sk.get("proficiency", "beginner"))
        d_mult = _duration_mult(sk.get("duration_months", 0))
        combined = p_mult * d_mult

        if any(t in name_n for t in SKILLS_TIER1):
            tier1_hits.append(sk["name"])
            raw_score += 3.0 * combined
        elif any(t in name_n for t in SKILLS_TIER2):
            tier2_hits.append(sk["name"])
            raw_score += 2.0 * combined
        elif any(t in name_n for t in SKILLS_TIER3):
            raw_score += 1.0 * combined

    # ---- Education ----
    best_tier = "unknown"
    best_field = ""
    edu_score = 0.0
    for e in edu:
        t = e.get("tier", "unknown")
        f = e.get("field_of_study", "").lower()
        tier_score = EDUCATION_TIER_SCORE.get(t, 0.30)
        field_bonus = 0.15 if any(cs in f for cs in CS_FIELDS) else 0.0
        score = min(1.0, tier_score + field_bonus)
        if score > edu_score:
            edu_score = score
            best_tier = t
            best_field = e.get("field_of_study", "")

    # ---- Behavioral signals ----
    today = date.today()
    last_active_str = sigs.get("last_active_date", "")
    try:
        la = date.fromisoformat(last_active_str)
        days_since = (today - la).days
    except (ValueError, TypeError):
        days_since = 999

    # ---- Location ----
    loc_lower = (location + " " + country).lower()
    preferred_cities = ["pune", "noida", "delhi", "ncr", "new delhi"]
    acceptable_cities = ["hyderabad", "mumbai", "bangalore", "bengaluru", "chennai",
                         "kolkata", "ahmedabad", "india"]
    in_preferred = any(c in loc_lower for c in preferred_cities)
    in_acceptable = country.lower() == "india" or any(c in loc_lower for c in acceptable_cities)

    # ---- Embedding text (short, fast to embed) ----
    top_skills = ", ".join(all_skill_names[:10])
    embedding_text = f"{title}. {headline}. Skills: {top_skills}. {summary[:200]}"

    return CandidateProfile(
        candidate_id=cid,
        current_title=title,
        headline=headline,
        summary=summary,
        country=country,
        location=location,
        years_of_experience=yoe,
        all_titles=all_titles,
        all_companies=all_companies,
        all_industries=all_industries,
        career_descriptions_combined=career_descriptions_combined,
        months_at_consulting=months_consulting,
        months_at_product=months_product,
        is_consulting_only=is_consulting_only,
        has_current_consulting_role=has_current_consulting_role,
        inferred_ai_ml_years=inferred_ai_ml_years,
        has_production_ml=has_production_ml,
        production_ml_evidence=production_ml_evidence,
        all_skill_names=all_skill_names,
        tier1_ai_skills=tier1_hits,
        tier2_ai_skills=tier2_hits,
        raw_skill_score=raw_score,
        best_edu_tier=best_tier,
        best_edu_field=best_field,
        education_score=edu_score,
        open_to_work=bool(sigs.get("open_to_work_flag", False)),
        last_active_date=last_active_str,
        days_since_active=days_since,
        recruiter_response_rate=float(sigs.get("recruiter_response_rate", 0)),
        avg_response_time_hours=float(sigs.get("avg_response_time_hours", 999)),
        notice_period_days=int(sigs.get("notice_period_days", 90)),
        github_activity_score=float(sigs.get("github_activity_score", -1)),
        interview_completion_rate=float(sigs.get("interview_completion_rate", 0)),
        offer_acceptance_rate=float(sigs.get("offer_acceptance_rate", -1)),
        profile_completeness=float(sigs.get("profile_completeness_score", 0)),
        connection_count=int(sigs.get("connection_count", 0)),
        endorsements_received=int(sigs.get("endorsements_received", 0)),
        salary_min_lpa=float((sigs.get("expected_salary_range_inr_lpa") or {}).get("min", 0)),
        salary_max_lpa=float((sigs.get("expected_salary_range_inr_lpa") or {}).get("max", 0)),
        in_india=in_acceptable,
        in_preferred_city=in_preferred,
        willing_to_relocate=bool(sigs.get("willing_to_relocate", False)),
        is_honeypot=False,
        honeypot_reason=None,
        embedding_text=embedding_text,
        raw=raw,
    )
