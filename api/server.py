"""
AI Hiring Copilot — FastAPI backend server.

Run:
    pip install fastapi uvicorn python-multipart
    uvicorn api.server:app --reload --port 8080
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))

from api.models import (
    AnalyticsResponse, CandidateDetail, CandidateSummary, ChatRequest,
    ChatResponse, ComparisonItem, ComparisonResponse, JDProfileResponse,
    JDValidationResponse, PaginatedCandidates, ResumeAnalysisResponse,
    StatsResponse,
)
from api.data_loader import DataStore, get_store

app = FastAPI(
    title="AI Hiring Copilot",
    description="Intelligent candidate discovery & ranking API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _store() -> DataStore:
    s = get_store()
    if not s.ready:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "pipeline_not_ready",
                "message": (
                    "Ranking pipeline has not been run yet. "
                    "Run: python rank.py --candidates candidates.jsonl --out submission.csv"
                ),
            },
        )
    return s


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    s = get_store()
    return {"status": "ok", "pipeline_ready": s.ready, "candidates_loaded": len(s.ranked_ids)}


# ─── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    return _store().stats


# ─── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/analytics", response_model=AnalyticsResponse)
def get_analytics():
    return _store().analytics


# ─── JD profile ────────────────────────────────────────────────────────────────

@app.get("/api/jd/profile", response_model=JDProfileResponse)
def get_jd_profile():
    s = _store()
    jd = s.jd
    return {
        "role": jd.role,
        "company": jd.company,
        "role_summary": jd.role_summary,
        "must_have_skills": jd.must_have_skill_categories,
        "nice_to_have_skills": jd.nice_to_have_skills,
        "experience_min_years": jd.experience_min_years,
        "experience_max_years": jd.experience_max_years,
        "preferred_locations": jd.preferred_locations,
        "notice_period_ideal_days": jd.notice_period_ideal_days,
        "disqualifiers": jd.disqualifiers,
    }


@app.post("/api/jd/validate", response_model=JDValidationResponse)
async def validate_jd(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    from agents.job_understanding_agent import build as build_initial
    from agents.jd_validator import JDValidator
    from knowledge import technology_timeline  # noqa

    if file:
        content = await file.read()
        jd_text = content.decode("utf-8", errors="replace")
    elif text:
        jd_text = text
    else:
        from agents.job_understanding_agent import JD_TEXT
        jd_text = JD_TEXT

    initial = build_initial()
    validator = JDValidator()
    result = validator.validate(jd_text, initial)

    skill_overload = None
    if result.skill_overload:
        so = result.skill_overload
        skill_overload = {
            "total_skills": so.total_skills,
            "complexity_score": so.complexity_score,
            "talent_availability": so.talent_availability,
            "recommendation": so.recommendation,
            "priority_skills": so.priority_skills,
            "optional_skills": so.optional_skills,
            "by_category": so.by_category,
        }

    corrected = result.corrected_profile
    return {
        "jd_quality_score": result.jd_quality_score,
        "role": corrected.role,
        "company": corrected.company,
        "experience_issues": [
            {
                "technology": i.technology,
                "requested_years": i.requested_years,
                "max_plausible_years": i.max_plausible_years,
                "mainstream_year": i.mainstream_year,
                "status": i.status.value,
                "reasoning": i.reasoning,
                "suggested_range": i.suggested_range,
            }
            for i in result.experience_issues
        ],
        "contradictions": [
            {
                "contradiction_type": c.contradiction_type,
                "signal_a": c.signal_a,
                "signal_b": c.signal_b,
                "explanation": c.explanation,
                "suggestion": c.suggestion,
            }
            for c in result.contradictions
        ],
        "skill_overload": skill_overload,
        "missing_requirements": [
            {
                "field_name": m.field_name,
                "importance": m.importance,
                "suggestion": m.suggestion,
            }
            for m in result.missing_requirements
        ],
        "transferable_mappings": [
            {
                "canonical_skill": t.canonical_skill,
                "competency": t.competency,
                "equivalents": t.equivalents,
            }
            for t in result.transferable_mappings[:15]
        ],
        "improvements_applied": result.improvements_applied,
        "must_have_skills": corrected.must_have_skill_categories,
        "nice_to_have_skills": corrected.nice_to_have_skills,
        "role_summary": corrected.role_summary,
        "experience_min_years": corrected.experience_min_years,
        "experience_max_years": corrected.experience_max_years,
    }


# ─── Candidates ────────────────────────────────────────────────────────────────

@app.get("/api/candidates", response_model=PaginatedCandidates)
def list_candidates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("rank", enum=["rank", "score", "experience", "ai_years"]),
    order: str = Query("asc", enum=["asc", "desc"]),
    search: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=1),
    has_production_ml: Optional[bool] = Query(None),
    open_to_work: Optional[bool] = Query(None),
    hidden_gems_only: bool = Query(False),
):
    s = _store()
    ids = s.ranked_ids[:]

    # Filter
    filtered = []
    for cid in ids:
        summ = s.summaries[cid]
        if min_score is not None and summ["overall_score"] < min_score:
            continue
        if has_production_ml is not None and summ["has_production_ml"] != has_production_ml:
            continue
        if open_to_work is not None and summ["open_to_work"] != open_to_work:
            continue
        if hidden_gems_only and not summ["is_hidden_gem"]:
            continue
        if search:
            q = search.lower()
            haystack = (
                summ["title"].lower()
                + " "
                + " ".join(summ["top_skills"]).lower()
                + " "
                + summ["location"].lower()
                + " "
                + cid.lower()
            )
            if q not in haystack:
                continue
        filtered.append(cid)

    # Sort
    key_map = {
        "rank": lambda cid: s.summaries[cid]["rank"],
        "score": lambda cid: -s.summaries[cid]["overall_score"],
        "experience": lambda cid: -s.summaries[cid]["experience_years"],
        "ai_years": lambda cid: -s.summaries[cid]["ai_ml_years"],
    }
    filtered.sort(key=key_map.get(sort, key_map["rank"]))
    if order == "desc" and sort == "rank":
        filtered.reverse()

    total = len(filtered)
    total_pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    page_ids = filtered[start: start + limit]

    return {
        "candidates": [s.summaries[cid] for cid in page_ids],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


@app.get("/api/candidates/hidden-gems")
def hidden_gems():
    s = _store()
    gems = [s.summaries[cid] for cid in s.hidden_gems]
    return {"candidates": gems, "total": len(gems)}


@app.get("/api/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: str):
    s = _store()
    if candidate_id not in s.details:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not in top-100")
    return s.details[candidate_id]


@app.post("/api/candidates/compare", response_model=ComparisonResponse)
def compare_candidates(candidate_ids: List[str]):
    s = _store()
    items = []
    for cid in candidate_ids[:5]:
        if cid not in s.details:
            raise HTTPException(status_code=404, detail=f"Candidate {cid} not found")
        d = s.details[cid]
        items.append({
            "candidate_id": cid,
            "rank": d["rank"],
            "title": d["title"],
            "overall_score": d["overall_score"],
            "score_breakdown": d["score_breakdown"],
            "top_skills": d["top_skills"],
            "experience_years": d["experience_years"],
            "ai_ml_years": d["ai_ml_years"],
            "has_production_ml": d["has_production_ml"],
            "notice_period_days": d["notice_period_days"],
            "location": d["location"],
            "reasoning": d["reasoning"],
        })

    if not items:
        raise HTTPException(status_code=400, detail="No valid candidates")

    winner_id = min(items, key=lambda x: x["rank"])["candidate_id"]

    # Dimension winners
    dims = ["experience", "projects", "semantic_match", "domain_fit", "behavior"]
    dim_winners = {}
    for dim in dims:
        best = max(items, key=lambda x: x["score_breakdown"].get(dim, 0))
        dim_winners[dim] = best["candidate_id"]

    # Analysis
    winner = next(x for x in items if x["candidate_id"] == winner_id)
    others = [x for x in items if x["candidate_id"] != winner_id]
    strengths = [d for d in dims if dim_winners.get(d) == winner_id]
    analysis = (
        f"{winner['title']} (rank #{winner['rank']}) ranks highest overall. "
    )
    if strengths:
        analysis += f"Strongest dimensions: {', '.join(strengths)}. "
    if others:
        second = sorted(others, key=lambda x: x["rank"])[0]
        diff = winner["overall_score"] - second["overall_score"]
        analysis += (
            f"Leads {second['title']} by {diff:.3f} points overall. "
            f"Key differentiators: production ML experience and project depth."
        )

    return {
        "candidates": items,
        "winner_id": winner_id,
        "analysis": analysis,
        "dimension_winners": dim_winners,
    }


# ─── Chat ──────────────────────────────────────────────────────────────────────

def _extract_candidate_ids(text: str, store: DataStore) -> List[str]:
    """Find candidate IDs mentioned in the text."""
    ids = re.findall(r"CAND_\d+", text.upper())
    ranks = re.findall(r"(?:rank(?:ed)?\s*#?|candidate\s*#?)\s*(\d+)", text.lower())
    result = list({cid for cid in ids if cid in store.summaries})
    for r in ranks:
        rank = int(r)
        for cid in store.ranked_ids:
            if store.summaries[cid]["rank"] == rank:
                result.append(cid)
                break
    return result[:3]


def _rule_based_response(message: str, store: DataStore) -> ChatResponse:
    msg_lower = message.lower()
    mentioned = _extract_candidate_ids(message, store)

    # Compare two candidates
    if re.search(r"why.*rank.*above|rank.*higher|better than", msg_lower) and len(mentioned) >= 2:
        a, b = mentioned[0], mentioned[1]
        sa = store.summaries[a]
        sb = store.summaries[b]
        da = store.details[a]["score_breakdown"]
        db = store.details[b]["score_breakdown"]
        diffs = {k: da.get(k, 0) - db.get(k, 0) for k in da}
        top_dim = max(diffs, key=lambda x: diffs[x])
        response = (
            f"**{sa['title']} ({a})** ranks #{sa['rank']} vs **{sb['title']} ({b})** at #{sb['rank']}.\n\n"
            f"Overall score difference: **{sa['overall_score'] - sb['overall_score']:+.3f}**\n\n"
            f"Largest gap: **{top_dim}** (+{diffs[top_dim]:.3f}). "
            f"{a}'s stronger {top_dim} score reflects "
            f"{'production ML experience and deployed systems' if top_dim == 'projects' else 'deeper domain alignment with this role'}."
        )
        return ChatResponse(response=response, candidate_ids=mentioned)

    # Find candidates with a skill
    skill_match = re.search(
        r"(?:with|who (?:has|have|know)|experience (?:in|with))\s+([A-Za-z0-9\-\+\.]{2,20})",
        msg_lower,
    )
    if skill_match:
        skill = skill_match.group(1).lower()
        matched = []
        for cid in store.ranked_ids:
            skills_lower = [s.lower() for s in store.summaries[cid]["top_skills"]]
            if any(skill in s for s in skills_lower):
                matched.append(cid)
        if matched:
            top3 = matched[:3]
            lines = [f"Found **{len(matched)}** candidates with **{skill}** experience:\n"]
            for cid in top3:
                s = store.summaries[cid]
                lines.append(f"- **{cid}** ({s['title']}, rank #{s['rank']}, score {s['overall_score']:.3f})")
            return ChatResponse(response="\n".join(lines), candidate_ids=top3)
        return ChatResponse(response=f"No top-100 candidates with explicit **{skill}** in their top skills. They may have equivalent experience under different terminology.")

    # Production ML question
    if re.search(r"production|deployed|live system|real user", msg_lower):
        prod = [cid for cid in store.ranked_ids if store.summaries[cid]["has_production_ml"]][:5]
        lines = [f"**{len(prod)}** top-ranked candidates have verified production ML experience:\n"]
        for cid in prod:
            s = store.summaries[cid]
            lines.append(f"- **{cid}** — {s['title']} (rank #{s['rank']}, score {s['overall_score']:.3f})")
        return ChatResponse(response="\n".join(lines), candidate_ids=prod[:3])

    # Highest hiring risk
    if re.search(r"risk|risky|concern|warning|avoid", msg_lower):
        risky = sorted(store.ranked_ids, key=lambda cid: store.details[cid]["score_breakdown"]["behavior"])[:3]
        lines = ["Candidates with **lower behavioral signals** (highest hiring risk):\n"]
        for cid in risky:
            s = store.summaries[cid]
            d = store.details[cid]
            beh = d["score_breakdown"]["behavior"]
            lines.append(f"- **{cid}** ({s['title']}, rank #{s['rank']}) — behavior score {beh:.3f}")
        return ChatResponse(response="\n".join(lines), candidate_ids=risky)

    # Score explanation
    if re.search(r"explain|what is|how is.*score|confidence", msg_lower):
        response = (
            "The **overall score** (0–1) is a weighted combination of 8 dimensions:\n\n"
            "| Dimension | Weight | What it measures |\n"
            "|-----------|--------|------------------|\n"
            "| Projects | 28% | Technical complexity, production deployment, AI stack depth |\n"
            "| Experience | 22% | Years of experience (peak at 7yr) + AI/ML-specific years |\n"
            "| Semantic Match | 20% | Embedding-based similarity to the JD |\n"
            "| Domain Fit | 12% | Title and career alignment with AI engineering |\n"
            "| Behavior | 8% | Redrob signals: availability, response rate, notice period |\n"
            "| Career Growth | 5% | Seniority progression trajectory |\n"
            "| Education | 3% | Degree quality and field relevance |\n"
            "| Certifications | 2% | Relevant ML/AI certifications |\n\n"
            "**Penalties** are applied multiplicatively: consulting-only (×0.40), honeypot (×0.04), "
            "keyword stuffer (×0.55)."
        )
        return ChatResponse(response=response)

    # Hidden gems
    if re.search(r"hidden gem|overlooked|underrated|low visibility", msg_lower):
        gems = store.hidden_gems[:4]
        lines = [f"Found **{len(store.hidden_gems)}** hidden gems — strong candidates with low recruiter visibility:\n"]
        for cid in gems:
            s = store.summaries[cid]
            lines.append(f"- **{cid}** — {s['title']} (rank #{s['rank']}, score {s['overall_score']:.3f}), open to work: {s['open_to_work']}")
        return ChatResponse(response="\n".join(lines), candidate_ids=gems)

    # Specific candidate lookup
    if mentioned:
        cid = mentioned[0]
        s = store.summaries[cid]
        d = store.details[cid]
        sb = d["score_breakdown"]
        response = (
            f"**{cid}** — {s['title']}\n\n"
            f"- **Rank**: #{s['rank']} | **Score**: {s['overall_score']:.3f}\n"
            f"- **Experience**: {s['experience_years']}yr total, {s['ai_ml_years']}yr AI/ML\n"
            f"- **Production ML**: {'Yes' if s['has_production_ml'] else 'No'}\n"
            f"- **Notice Period**: {s['notice_period_days']} days\n"
            f"- **Score Breakdown**: Projects {sb['projects']:.2f} | Semantic {sb['semantic_match']:.2f} | Domain {sb['domain_fit']:.2f}\n\n"
            f"**Reasoning**: {s['reasoning'][:300]}..."
        )
        return ChatResponse(response=response, candidate_ids=[cid])

    # Default
    top3 = store.ranked_ids[:3]
    lines = [
        "I can help you explore the candidate pool. Try asking:\n",
        '- "Why is candidate #2 ranked above #5?"',
        '- "Show me candidates with FAISS experience"',
        '- "Who has the strongest production ML background?"',
        '- "Explain the confidence score"',
        '- "Which candidates are hidden gems?"',
        "\nHere are the **top 3 candidates**:\n",
    ]
    for cid in top3:
        s = store.summaries[cid]
        lines.append(f"- **{cid}** — {s['title']} (rank #{s['rank']}, score {s['overall_score']:.3f})")
    return ChatResponse(response="\n".join(lines), candidate_ids=top3)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    s = _store()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            # Build context with top-10 candidate summaries
            context = json.dumps([s.summaries[cid] for cid in s.ranked_ids[:10]], indent=2)
            messages = [
                {"role": m.role, "content": m.content}
                for m in request.history[-6:]
            ] + [{"role": "user", "content": request.message}]

            system = (
                "You are an AI Hiring Copilot assistant helping a technical recruiter. "
                "You have access to ranked candidate data. Answer questions factually "
                "based ONLY on the provided data. Do not hallucinate. Use markdown formatting.\n\n"
                f"TOP CANDIDATES DATA:\n{context}"
            )
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=system,
                messages=messages,
            )
            response_text = resp.content[0].text
            mentioned = _extract_candidate_ids(request.message, s)
            return ChatResponse(response=response_text, candidate_ids=mentioned)
        except Exception:
            pass

    return _rule_based_response(request.message, s)


# ─── Candidate portal ─────────────────────────────────────────────────────────

@app.post("/api/portal/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(resume_text: str = Form(...)):
    s = _store()
    jd = s.jd

    text_lower = resume_text.lower()

    # Match against JD must-have skill categories
    matched_skills = []
    missing_skills = []
    for category, skills in jd.must_have_skill_categories.items():
        category_matched = [sk for sk in skills if sk.lower() in text_lower]
        if category_matched:
            matched_skills.extend(category_matched[:2])
        else:
            missing_skills.append(skills[0] if skills else category)

    transferable = []
    for sk in jd.nice_to_have_skills:
        if sk.lower() in text_lower:
            transferable.append(sk)

    match_score = round(min(1.0, len(matched_skills) / max(len(jd.must_have_skill_categories), 1)), 2)

    strengths = [f"Experience with {sk}" for sk in matched_skills[:4]]
    weaknesses = [f"Limited evidence of {sk}" for sk in missing_skills[:4]]

    career_suggestions = [
        "Build a RAG pipeline project on GitHub to demonstrate retrieval skills",
        "Contribute to an open-source embedding or vector-search library",
        "Write a technical blog post on production ML system design",
    ]
    recommended_projects = [
        "End-to-end RAG pipeline with FAISS + sentence-transformers",
        "Hybrid search system (BM25 + dense retrieval) with NDCG evaluation",
        "LLM fine-tuning with LoRA on a domain-specific dataset",
    ]
    recommended_certs = [
        "DeepLearning.AI — Building Systems with the ChatGPT API",
        "Hugging Face NLP Course (free)",
        "Google Cloud Professional ML Engineer",
    ]

    estimated_improvement = round(min(1.0, match_score + 0.15), 2)

    return {
        "match_score": match_score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "transferable_skills": transferable[:6],
        "missing_skills": missing_skills[:6],
        "career_suggestions": career_suggestions,
        "recommended_projects": recommended_projects,
        "recommended_certifications": recommended_certs,
        "estimated_improvement": estimated_improvement,
    }
