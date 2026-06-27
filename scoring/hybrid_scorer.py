"""
Layer 6: Hybrid Scoring
Combines experience, project depth, semantic match, domain fit,
behavioral signals, career growth, education, and certifications
into a single final score.
Applies multiplicative penalties for hard disqualifiers.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Dict
from parsers.candidate_parser import CandidateProfile
from agents.job_understanding_agent import HiringProfile
from utils.text_utils import normalize, contains_any


# ── Domain fit ─────────────────────────────────────────────────────────────

# Titles that strongly signal this candidate does AI/ML work
_STRONG_AI_TITLES = {
    "ai engineer", "ml engineer", "machine learning engineer",
    "data scientist", "nlp engineer", "research engineer",
    "applied ml engineer", "applied scientist",
    "recommendation systems engineer", "search engineer",
    "retrieval engineer", "ai/ml engineer", "ai specialist",
    "senior ai engineer", "lead ai engineer", "staff ml engineer",
    "senior ml engineer", "senior data scientist",
    "senior nlp engineer", "ai research engineer",
    "computer vision engineer",  # partial relevance
}

# Titles that suggest adjacent/transferable work
_ADJACENT_TITLES = {
    "data engineer", "analytics engineer", "backend engineer",
    "software engineer", "full stack developer", "senior software engineer",
    "senior software engineer (ml)", "devops engineer",
    "cloud engineer", "data analyst",
}

# Titles that are almost certainly a mismatch
_MISMATCH_TITLES = {
    "hr manager", "accountant", "content writer", "graphic designer",
    "marketing manager", "sales executive", "operations manager",
    "project manager", "customer support", "civil engineer",
    "mechanical engineer", "frontend engineer", "mobile developer",
    "java developer", ".net developer", "qa engineer",
}

_PREFERRED_LOCS = {"pune", "noida", "delhi", "ncr", "new delhi", "gurgaon", "gurugram"}
_ACCEPTABLE_LOCS = {"hyderabad", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "india"}


def _experience_score(yoe: float, ai_years: float, cfg: dict) -> float:
    """
    Scores experience fit. Peak at ideal_years; graceful decay outside 5–9.
    Separately rewards AI/ML-specific years.
    """
    exp_cfg = cfg.get("experience", {})
    ideal_min = exp_cfg.get("ideal_min", 5)
    ideal_max = exp_cfg.get("ideal_max", 9)
    peak = exp_cfg.get("peak", 7)
    ai_min = exp_cfg.get("ai_ml_min_years", 3)

    # YoE curve: triangle peak at `peak` years
    if yoe < ideal_min:
        base = max(0.10, yoe / ideal_min)
    elif yoe <= ideal_max:
        dist = abs(yoe - peak) / (ideal_max - ideal_min)
        base = 1.0 - 0.20 * dist
    else:
        # Grace decay above upper bound
        base = max(0.50, 1.0 - 0.05 * (yoe - ideal_max))

    # AI years component
    ai_score = min(1.0, ai_years / max(ai_min, 1))

    return round(0.65 * base + 0.35 * ai_score, 4)


def _domain_fit_score(cp: CandidateProfile, jd: HiringProfile) -> float:
    """
    Evaluates title/career domain alignment with the JD.
    Guards against keyword stuffers: a Marketing Manager with AI skills
    has low domain fit regardless of their skill list.
    """
    title_lower = normalize(cp.current_title)
    career_titles_lower = [normalize(t) for t in cp.all_titles]

    # Check if ANY past title was in the strong AI set
    ever_ai_title = any(
        any(ai_t in t for ai_t in _STRONG_AI_TITLES)
        for t in career_titles_lower
    )
    ever_adjacent = any(
        any(adj in t for adj in _ADJACENT_TITLES)
        for t in career_titles_lower
    )
    current_is_mismatch = any(mm in title_lower for mm in _MISMATCH_TITLES)
    current_is_ai = any(ai_t in title_lower for ai_t in _STRONG_AI_TITLES)
    current_is_adj = any(adj in title_lower for adj in _ADJACENT_TITLES)

    # Has inferred AI/ML years from career descriptions
    has_real_ai_work = cp.inferred_ai_ml_years >= 1.5

    if current_is_ai and has_real_ai_work:
        return 1.0
    if current_is_ai and not has_real_ai_work:
        return 0.70  # title says AI but descriptions don't confirm it
    if current_is_adj and (ever_ai_title or has_real_ai_work):
        return 0.75
    if current_is_adj and not has_real_ai_work:
        return 0.50
    if ever_ai_title and has_real_ai_work:
        return 0.65  # currently in adjacent role but strong AI background
    if current_is_mismatch and has_real_ai_work:
        return 0.35  # keyword stuffer pattern
    if current_is_mismatch:
        return 0.10  # clear mismatch
    # Unknown title
    return 0.45 if has_real_ai_work else 0.25


def _career_growth_score(cp: CandidateProfile) -> float:
    """
    Infers career progression quality:
    - ascending seniority = positive
    - mixing seniority levels coherently = neutral
    - stagnation or demotion = negative
    """
    titles = [normalize(t) for t in cp.all_titles if t]

    seniority_map = {
        "junior": 1, "associate": 1,
        "": 2,  # unadorned = mid-level
        "senior": 3, "lead": 4, "staff": 5,
        "principal": 6, "director": 7, "head": 7, "vp": 8, "cto": 9,
    }

    def _level(t: str) -> int:
        for key, val in sorted(seniority_map.items(), key=lambda x: -len(x[0])):
            if key and key in t:
                return val
        return 2

    levels = [_level(t) for t in titles]
    if len(levels) < 2:
        return 0.60

    # Did they go up overall?
    earliest = levels[-1]  # career_history is [current, ..., oldest]
    latest = levels[0]
    delta = latest - earliest

    if delta >= 2:
        return 1.0
    if delta == 1:
        return 0.80
    if delta == 0:
        return 0.60  # lateral — may be fine in ML (specialist track)
    return max(0.20, 0.60 + delta * 0.15)  # regression in seniority


def _education_score(cp: CandidateProfile) -> float:
    return cp.education_score


def _certification_score(cp: CandidateProfile) -> float:
    certs = cp.raw.get("certifications", []) or []
    if not certs:
        return 0.30  # absence not penalised harshly

    # Relevant certification issuers / names
    relevant = [
        "deeplearning.ai", "coursera", "google", "aws", "hugging face",
        "nvidia", "pytorch", "tensorflow", "microsoft", "nvidia",
        "stanford", "mit", "fast.ai",
    ]
    hits = sum(
        1 for c in certs
        if contains_any(c.get("name", "") + " " + c.get("issuer", ""), relevant)
    )
    return min(1.0, 0.30 + 0.15 * hits)


# ── Penalty multipliers ────────────────────────────────────────────────────

def _compute_penalty(cp: CandidateProfile, cfg: dict) -> float:
    """
    Returns a multiplicative penalty ≤ 1.0.
    Multiple penalties stack multiplicatively.
    """
    pen = cfg.get("penalties", {})
    multiplier = 1.0

    if cp.is_honeypot:
        return pen.get("honeypot", 0.04)

    if cp.is_consulting_only:
        multiplier *= pen.get("consulting_only", 0.40)

    title_lower = normalize(cp.current_title)
    is_mismatch_title = any(mm in title_lower for mm in _MISMATCH_TITLES)
    is_ai_title = any(ai_t in title_lower for ai_t in _STRONG_AI_TITLES)

    # Keyword stuffer: non-AI title with no real AI career history
    # Applied regardless of skill count — skills are synthetically noisy in this dataset
    if is_mismatch_title and cp.inferred_ai_ml_years < 1.5 and not cp.has_production_ml:
        multiplier *= pen.get("title_career_mismatch", 0.55)

    # No production AI despite claiming AI role
    if is_ai_title and not cp.has_production_ml and cp.inferred_ai_ml_years < 1.0:
        multiplier *= pen.get("no_production_ai", 0.70)

    # Outside India + not willing to relocate
    if not cp.in_india and not cp.willing_to_relocate:
        multiplier *= pen.get("outside_india_no_relocate", 0.88)

    # Very high notice period > 120 days
    if cp.notice_period_days > 120:
        multiplier *= pen.get("very_high_notice", 0.92)

    return round(max(0.04, multiplier), 4)


# ── Dataclass for scored result ────────────────────────────────────────────

@dataclass
class ScoredCandidate:
    candidate_id: str
    profile: CandidateProfile
    exp_score: float
    project_score: float
    semantic_score: float
    domain_score: float
    behavioral_score: float
    career_growth_score: float
    education_score: float
    cert_score: float
    penalty: float
    raw_composite: float
    final_score: float
    project_breakdown: dict = field(default_factory=dict)
    rank: int = 0
    reasoning: str = ""


def score(
    cp: CandidateProfile,
    jd: HiringProfile,
    project_score: float,
    semantic_score: float,
    behavioral_score: float,
    cfg: dict,
    project_breakdown: Optional[Dict] = None,
) -> ScoredCandidate:
    """
    Assemble all sub-scores into the final scored candidate.
    """
    w = cfg.get("scoring", {})

    exp_s = _experience_score(cp.years_of_experience, cp.inferred_ai_ml_years, cfg)
    domain_s = _domain_fit_score(cp, jd)
    growth_s = _career_growth_score(cp)
    edu_s = _education_score(cp)
    cert_s = _certification_score(cp)

    raw = (
        w.get("experience", 0.22) * exp_s
        + w.get("projects", 0.28) * project_score
        + w.get("semantic_match", 0.20) * semantic_score
        + w.get("domain_fit", 0.12) * domain_s
        + w.get("behavior", 0.08) * behavioral_score
        + w.get("career_growth", 0.05) * growth_s
        + w.get("education", 0.03) * edu_s
        + w.get("certifications", 0.02) * cert_s
    )

    penalty = _compute_penalty(cp, cfg)
    final = round(max(0.0, min(1.0, raw * penalty)), 6)

    return ScoredCandidate(
        candidate_id=cp.candidate_id,
        profile=cp,
        exp_score=exp_s,
        project_score=project_score,
        semantic_score=semantic_score,
        domain_score=domain_s,
        behavioral_score=behavioral_score,
        career_growth_score=growth_s,
        education_score=edu_s,
        cert_score=cert_s,
        penalty=penalty,
        raw_composite=round(raw, 6),
        final_score=final,
        project_breakdown=project_breakdown or {},
    )
