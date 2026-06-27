"""
Layer 7: LLM Explanation Layer
Generates honest, fact-anchored reasoning for each ranked candidate.

Default mode: deterministic template engine that pulls real facts from the profile.
              No hallucination possible — every claim cites actual profile data.
Optional mode: Claude API (pre-computation, offline).
              Set ANTHROPIC_API_KEY and pass --use-llm to rank.py.

Stage 4 checks require:
  ✓ Specific facts referenced  ✓ JD connection  ✓ Honest concerns
  ✓ No hallucination           ✓ Variation       ✓ Rank-consistent tone
"""
from __future__ import annotations
from typing import Optional
from parsers.candidate_parser import CandidateProfile
from scoring.hybrid_scorer import ScoredCandidate
from utils.text_utils import normalize


# ── Strength / weakness descriptors ───────────────────────────────────────

def _tier_label(rank: int) -> str:
    if rank <= 5:   return "top-tier"
    if rank <= 15:  return "strong"
    if rank <= 30:  return "good"
    if rank <= 60:  return "moderate"
    return "marginal"


def _format_skills(skills: list, limit: int = 4) -> str:
    return ", ".join(skills[:limit]) if skills else "none identified"


def _notice_label(days: int) -> str:
    if days <= 15: return f"{days}d (immediately joinable)"
    if days <= 30: return f"{days}d (ideal)"
    if days <= 60: return f"{days}d (acceptable)"
    if days <= 90: return f"{days}d (workable)"
    return f"{days}d (high — JD notes bar rises above 90d)"


def _activity_label(days_since: int) -> str:
    if days_since <= 7:  return "active this week"
    if days_since <= 30: return f"active {days_since}d ago"
    if days_since <= 90: return f"last seen {days_since}d ago (somewhat stale)"
    return f"inactive for {days_since}d (significant staleness risk)"


def _response_label(rate: float) -> str:
    if rate >= 0.75: return f"{rate:.0%} (excellent)"
    if rate >= 0.50: return f"{rate:.0%} (good)"
    if rate >= 0.30: return f"{rate:.0%} (moderate)"
    return f"{rate:.0%} (low — outreach may be difficult)"


def _missing_skills(sc: ScoredCandidate) -> str:
    """
    Compute skills mentioned in the JD's must-have categories
    that are absent from the candidate's profile.
    """
    jd_must_haves_sample = [
        "FAISS/Qdrant/Weaviate", "sentence-transformers/embeddings",
        "NDCG/MAP/MRR evaluation", "LoRA/PEFT fine-tuning",
        "production ML deployment", "hybrid retrieval (BM25+dense)",
    ]
    cp = sc.profile
    all_skills_lower = " ".join(normalize(s) for s in cp.all_skill_names)
    desc_lower = normalize(cp.career_descriptions_combined)

    missing = []
    for item in jd_must_haves_sample:
        keywords = [normalize(k.strip()) for k in item.replace("/", " ").split()]
        if not any(k in all_skills_lower or k in desc_lower for k in keywords):
            missing.append(item)

    return ", ".join(missing[:3]) if missing else "none obvious"


# ── Template engine ────────────────────────────────────────────────────────

def generate_template(sc: ScoredCandidate) -> str:
    """
    Builds a 1–2 sentence reasoning string that references only real profile facts.
    Varies tone and content based on rank tier.
    """
    cp = sc.profile
    rank = sc.rank
    label = _tier_label(rank)

    t1 = _format_skills(cp.tier1_ai_skills, 3)
    t2 = _format_skills(cp.tier2_ai_skills, 2)
    notice = _notice_label(cp.notice_period_days)
    activity = _activity_label(cp.days_since_active)
    response = _response_label(cp.recruiter_response_rate)
    missing = _missing_skills(sc)

    yoe = cp.years_of_experience
    ai_years = round(cp.inferred_ai_ml_years, 1)
    title = cp.current_title
    loc = f"{cp.location}, {cp.country}" if cp.location else cp.country

    # ── Strength statement ──
    if cp.has_production_ml and ai_years >= 3:
        strength = (
            f"{title} ({yoe}yr total, ~{ai_years}yr inferred AI/ML) with confirmed "
            f"production ML signals in career descriptions"
        )
    elif ai_years >= 2:
        strength = (
            f"{title} with {yoe}yr total experience and ~{ai_years}yr inferred in ML/AI work"
        )
    else:
        strength = f"{title} with {yoe}yr experience"

    # ── Skill highlight ──
    if t1 and t1 != "none identified":
        skill_note = f"JD-relevant Tier-1 skills: {t1}"
    elif t2 and t2 != "none identified":
        skill_note = f"Adjacent AI skills: {t2}"
    else:
        skill_note = "limited AI-specific skills in profile"

    # ── Concern statement (honest, rank-consistent) ──
    concerns = []
    if cp.is_consulting_only:
        concerns.append("entire career at consulting firms (JD explicitly penalises this)")
    elif cp.has_current_consulting_role:
        concerns.append(f"currently at consulting firm ({cp.all_companies[0] if cp.all_companies else '?'}), though prior product exp may exist")
    if cp.days_since_active > 90:
        concerns.append(f"{activity}")
    if cp.recruiter_response_rate < 0.30:
        concerns.append(f"response rate {response}")
    if cp.notice_period_days > 90:
        concerns.append(f"notice period {notice}")
    if missing != "none obvious":
        concerns.append(f"missing JD signals: {missing}")
    if sc.penalty < 0.70:
        concerns.append("honeypot/disqualifier flag applied")

    concern_str = "; ".join(concerns[:2]) if concerns else "no major red flags"

    # ── Behavioural note ──
    open_str = "open to work" if cp.open_to_work else "not marked open-to-work"
    loc_str = (
        "preferred city" if cp.in_preferred_city
        else ("India-based" if cp.in_india else f"non-India ({loc})")
    )

    # ── Compose final string ──
    part1 = f"{label.capitalize()} match — {strength}. {skill_note}."
    part2 = f"Concerns: {concern_str}. Platform: {open_str}, {loc_str}, notice {notice}, response {response}."

    return f"{part1} {part2}"


# ── Optional Claude API path ───────────────────────────────────────────────

def generate_llm(sc: ScoredCandidate, client) -> str:
    """
    Calls Claude API for a richer explanation.
    `client` is an anthropic.Anthropic() instance.
    Only used in pre-computation mode (never during the timed ranking step).
    """
    cp = sc.profile
    profile_snapshot = {
        "candidate_id": cp.candidate_id,
        "current_title": cp.current_title,
        "years_of_experience": cp.years_of_experience,
        "inferred_ai_ml_years": round(cp.inferred_ai_ml_years, 1),
        "tier1_skills": cp.tier1_ai_skills[:6],
        "tier2_skills": cp.tier2_ai_skills[:4],
        "has_production_ml": cp.has_production_ml,
        "is_consulting_only": cp.is_consulting_only,
        "open_to_work": cp.open_to_work,
        "days_since_active": cp.days_since_active,
        "recruiter_response_rate": cp.recruiter_response_rate,
        "notice_period_days": cp.notice_period_days,
        "location": f"{cp.location}, {cp.country}",
        "in_india": cp.in_india,
        "education_tier": cp.best_edu_tier,
    }

    jd_summary = (
        "Senior AI Engineer at Series A startup. Must have: production embeddings/retrieval, "
        "vector DB experience, NDCG/MAP evaluation, 5-9yr exp (ideal 6-8), product company "
        "background. Based in Pune/Noida. No consulting-only careers."
    )

    prompt = f"""You are writing a brief, honest recruiter note for a ranked candidate.
Rank: {sc.rank}/100 | Score: {sc.final_score:.3f}

JD summary: {jd_summary}

Candidate snapshot (only these facts exist — do not invent others):
{profile_snapshot}

Write exactly 2 sentences:
1. Strengths referencing specific facts from the snapshot.
2. Concerns or gaps, acknowledging the rank honestly. If rank ≤ 10, tone should be positive with minor caveats. If rank > 70, tone should be honest about misfit.
No hallucination. Reference only facts from the snapshot above."""

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text.strip().replace("\n", " ")


# ── Public interface ───────────────────────────────────────────────────────

def generate(sc: ScoredCandidate, llm_client=None) -> str:
    """
    Returns a reasoning string for the submission CSV.
    Uses LLM if client is provided, otherwise uses the template engine.
    """
    if llm_client is not None:
        try:
            return generate_llm(sc, llm_client)
        except Exception:
            pass  # fall through to template on any API error
    return generate_template(sc)
