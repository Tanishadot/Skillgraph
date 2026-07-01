"""
AI Hiring Copilot — FastAPI backend server.

Run:
    uvicorn api.server:app --reload --port 8080

Environment variables:
    ALLOWED_ORIGINS  Comma-separated list of allowed CORS origins.
                     Defaults to http://localhost:5173,http://127.0.0.1:5173
    ANTHROPIC_API_KEY  Optional. Enables Claude-powered AI Copilot responses.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))

from api.models import (
    AnalyticsResponse, CandidateDetail, ChatRequest, ChatResponse,
    ComparisonResponse, JDProfileResponse, JDValidationResponse,
    PaginatedCandidates, ResumeAnalysisResponse, StatsResponse,
)
from api.data_loader import DataStore, get_store

app = FastAPI(
    title="SkillGraph AI — Hiring Copilot",
    description="Intelligent candidate discovery & ranking API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
    return {
        "status": "ok",
        "pipeline_ready": s.ready,
        "candidates_loaded": len(s.ranked_ids),
        "version": "1.0.0",
    }


# ─── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    return _store().stats


# ─── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/analytics", response_model=AnalyticsResponse)
def get_analytics():
    return _store().analytics


# ─── JD ────────────────────────────────────────────────────────────────────────

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
    from agents.job_understanding_agent import build as build_initial, JD_TEXT
    from agents.jd_validator import JDValidator

    if file and file.filename:
        content = await file.read()
        jd_text = content.decode("utf-8", errors="replace")
    elif text and text.strip():
        jd_text = text.strip()
    else:
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

    key_map = {
        "rank": lambda c: s.summaries[c]["rank"],
        "score": lambda c: -s.summaries[c]["overall_score"],
        "experience": lambda c: -s.summaries[c]["experience_years"],
        "ai_years": lambda c: -s.summaries[c]["ai_ml_years"],
    }
    reverse = order == "desc"
    if sort == "rank":
        filtered.sort(key=key_map["rank"], reverse=reverse)
    else:
        filtered.sort(key=key_map.get(sort, key_map["rank"]))

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
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found in top-{len(s.ranked_ids)}")
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
        raise HTTPException(status_code=400, detail="No valid candidates provided")

    winner_id = min(items, key=lambda x: x["rank"])["candidate_id"]
    dims = ["experience", "projects", "semantic_match", "domain_fit", "behavior", "career_growth"]
    dim_winners = {}
    for dim in dims:
        best = max(items, key=lambda x: x["score_breakdown"].get(dim, 0))
        dim_winners[dim] = best["candidate_id"]

    winner = next(x for x in items if x["candidate_id"] == winner_id)
    others = sorted([x for x in items if x["candidate_id"] != winner_id], key=lambda x: x["rank"])
    strengths = [d for d in dims if dim_winners.get(d) == winner_id]

    analysis = f"**{winner['title']}** (Rank #{winner['rank']}, Score {winner['overall_score']:.3f}) is the strongest match. "
    if strengths:
        analysis += f"Leads on: {', '.join(s.replace('_', ' ').title() for s in strengths)}. "
    if others:
        second = others[0]
        diff = winner["overall_score"] - second["overall_score"]
        analysis += f"Edges out #{second['rank']} by {diff:.3f} points overall."

    return {
        "candidates": items,
        "winner_id": winner_id,
        "analysis": analysis,
        "dimension_winners": dim_winners,
    }


# ─── Chat ──────────────────────────────────────────────────────────────────────

def _extract_ids(text: str, store: DataStore) -> List[str]:
    ids = re.findall(r"CAND_\d+", text.upper())
    ranks = re.findall(r"(?:rank(?:ed)?\s*#?|candidate\s*#?)\s*(\d+)", text.lower())
    result = list(dict.fromkeys(cid for cid in ids if cid in store.summaries))
    for r in ranks:
        rank = int(r)
        for cid in store.ranked_ids:
            if store.summaries[cid]["rank"] == rank and cid not in result:
                result.append(cid)
                break
    return result[:3]


def _rule_chat(message: str, store: DataStore) -> ChatResponse:
    msg = message.lower()
    mentioned = _extract_ids(message, store)

    if re.search(r"why.*rank.*above|rank.*higher|better than|versus|vs\.?", msg) and len(mentioned) >= 2:
        a, b = mentioned[0], mentioned[1]
        sa, sb = store.summaries[a], store.summaries[b]
        da, db = store.details[a]["score_breakdown"], store.details[b]["score_breakdown"]
        diffs = {k: da.get(k, 0) - db.get(k, 0) for k in da if k != "penalty"}
        top_dim = max(diffs, key=lambda x: diffs[x])
        resp = (
            f"**{sa['title']} ({a})** ranks #{sa['rank']} vs **{sb['title']} ({b})** at #{sb['rank']}.\n\n"
            f"Score gap: **{sa['overall_score'] - sb['overall_score']:+.3f}**\n\n"
            f"Biggest advantage: **{top_dim.replace('_', ' ').title()}** (+{diffs[top_dim]:.3f}). "
            f"This reflects {'deeper production ML deployment history' if top_dim == 'projects' else 'stronger alignment with the job requirements'}."
        )
        return ChatResponse(response=resp, sources=[], candidate_ids=mentioned)

    skill_m = re.search(r"(?:with|who (?:has|have|know[s]?)|experience (?:in|with))\s+([A-Za-z0-9\-\+\.]{2,25})", msg)
    if skill_m:
        skill = skill_m.group(1).lower()
        matched = [cid for cid in store.ranked_ids if any(skill in s.lower() for s in store.summaries[cid]["top_skills"])]
        if matched:
            lines = [f"Found **{len(matched)}** candidates with **{skill}** skills:\n"]
            for cid in matched[:4]:
                s = store.summaries[cid]
                lines.append(f"- **{cid}** — {s['title']} (#{s['rank']}, {s['overall_score']:.3f})")
            return ChatResponse(response="\n".join(lines), sources=[], candidate_ids=matched[:3])
        return ChatResponse(response=f"No candidates with explicit **{skill}** in top skills. Similar skills may be listed under related technologies.", sources=[], candidate_ids=[])

    if re.search(r"production|deployed|live|real.world", msg):
        prod = [cid for cid in store.ranked_ids if store.summaries[cid]["has_production_ml"]][:5]
        lines = [f"**{len(prod)}** candidates with verified production ML deployments:\n"]
        for cid in prod:
            s = store.summaries[cid]
            lines.append(f"- **{cid}** — {s['title']} (#{s['rank']}, {s['overall_score']:.3f})")
        return ChatResponse(response="\n".join(lines), sources=[], candidate_ids=prod[:3])

    if re.search(r"risk|concern|warn|avoid|honeypot|consulting", msg):
        risky = sorted(store.ranked_ids, key=lambda cid: store.details[cid]["score_breakdown"]["behavior"])[:3]
        lines = ["Candidates with **lowest behavioral signals** — highest engagement risk:\n"]
        for cid in risky:
            s = store.summaries[cid]
            beh = store.details[cid]["score_breakdown"]["behavior"]
            lines.append(f"- **{cid}** ({s['title']}, #{s['rank']}) — behavior: {beh:.3f}")
        return ChatResponse(response="\n".join(lines), sources=[], candidate_ids=risky)

    if re.search(r"explain|score|weight|how.*rank|method|algorithm", msg):
        resp = (
            "The **SkillGraph score** is a weighted composite across 8 dimensions:\n\n"
            "| Dimension | Weight | Signal |\n"
            "|-----------|--------|--------|\n"
            "| Projects | **28%** | Production ML complexity, deployment, stack depth |\n"
            "| Experience | **22%** | Total years + AI/ML-specific years |\n"
            "| Semantic Match | **20%** | SBERT embedding similarity to JD |\n"
            "| Domain Fit | **12%** | Title/career alignment with role |\n"
            "| Behavior | **8%** | Availability, response rate, notice period |\n"
            "| Career Growth | **5%** | Seniority trajectory |\n"
            "| Education | **3%** | Degree tier + field relevance |\n"
            "| Certifications | **2%** | Relevant ML/AI credentials |\n\n"
            "**Penalties** (multiplicative): Consulting-only ×0.40 · Honeypot ×0.04 · Keyword stuffer ×0.55"
        )
        return ChatResponse(response=resp, sources=[], candidate_ids=[])

    if re.search(r"hidden gem|overlooked|underrated|low visibility", msg):
        gems = store.hidden_gems[:4]
        lines = [f"**{len(store.hidden_gems)}** hidden gems detected — strong fit, low recruiter contact:\n"]
        for cid in gems:
            s = store.summaries[cid]
            lines.append(f"- **{cid}** — {s['title']} (#{s['rank']}, {s['overall_score']:.3f}) · Open: {s['open_to_work']}")
        return ChatResponse(response="\n".join(lines), sources=[], candidate_ids=gems)

    if mentioned:
        cid = mentioned[0]
        s = store.summaries[cid]
        d = store.details[cid]
        sb = d["score_breakdown"]
        resp = (
            f"**{cid}** — {s['title']}\n\n"
            f"| Field | Value |\n|-------|-------|\n"
            f"| Rank | #{s['rank']} |\n"
            f"| Score | {s['overall_score']:.3f} |\n"
            f"| Experience | {s['experience_years']}yr total, {s['ai_ml_years']}yr AI/ML |\n"
            f"| Production ML | {'✓ Yes' if s['has_production_ml'] else '✗ No'} |\n"
            f"| Notice Period | {s['notice_period_days']} days |\n"
            f"| Location | {s['location']} |\n\n"
            f"**Projects** {sb.get('projects', 0):.2f} · **Semantic** {sb.get('semantic_match', 0):.2f} · **Domain** {sb.get('domain_fit', 0):.2f} · **Behavior** {sb.get('behavior', 0):.2f}\n\n"
            f"*{s['reasoning'][:250]}...*"
        )
        return ChatResponse(response=resp, sources=[], candidate_ids=[cid])

    top3 = store.ranked_ids[:3]
    lines = [
        "I'm your **SkillGraph AI Copilot**. Try asking:\n",
        '- "Why is candidate #1 ranked above #3?"',
        '- "Show me candidates with LangChain experience"',
        '- "Who has production ML deployments?"',
        '- "Explain the scoring methodology"',
        '- "Which candidates are hidden gems?"',
        "\n**Top 3 candidates right now:**\n",
    ]
    for cid in top3:
        s = store.summaries[cid]
        lines.append(f"- **{cid}** — {s['title']} (#{s['rank']}, {s['overall_score']:.3f})")
    return ChatResponse(response="\n".join(lines), sources=[], candidate_ids=top3)


def _build_chat_context(message: str, store: DataStore) -> str:
    """
    Build focused context for Claude: include mentioned candidates' full details
    plus a summary of the top-5. Avoids dumping all 100 candidates into the prompt.
    """
    mentioned = _extract_ids(message, store)

    # Full detail for explicitly mentioned candidates
    detail_blocks = []
    for cid in mentioned:
        if cid in store.details:
            d = store.details[cid]
            sb = d["score_breakdown"]
            detail_blocks.append(
                f"=== {cid} (Rank #{d['rank']}, Score {d['overall_score']:.3f}) ===\n"
                f"Title: {d['title']} | Exp: {d['experience_years']}yr | AI: {d['ai_ml_years']}yr\n"
                f"Location: {d['location']} | Notice: {d['notice_period_days']}d\n"
                f"Prod ML: {d['has_production_ml']} | Open: {d['open_to_work']}\n"
                f"Scores — Projects:{sb.get('projects',0):.2f} Semantic:{sb.get('semantic_match',0):.2f} "
                f"Exp:{sb.get('experience',0):.2f} Domain:{sb.get('domain_fit',0):.2f} "
                f"Behavior:{sb.get('behavior',0):.2f} Growth:{sb.get('career_growth',0):.2f}\n"
                f"Reasoning: {d['reasoning'][:300]}"
            )

    # Always include top-5 summary for general context
    top5 = [
        f"#{store.summaries[cid]['rank']} {cid}: {store.summaries[cid]['title']} "
        f"({store.summaries[cid]['overall_score']:.3f})"
        for cid in store.ranked_ids[:5]
    ]

    parts = [f"TOP-5 CANDIDATES:\n" + "\n".join(top5)]
    if detail_blocks:
        parts.append("CANDIDATE DETAILS (from your query):\n" + "\n\n".join(detail_blocks))

    return "\n\n".join(parts)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    s = _store()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            context = _build_chat_context(request.message, s)
            messages = [{"role": m.role, "content": m.content} for m in request.history[-6:]]
            messages.append({"role": "user", "content": request.message})
            system = (
                "You are SkillGraph AI, an intelligent hiring copilot for technical recruiters. "
                "Answer factually based on the provided candidate data. Use markdown. Be concise.\n\n"
                f"PIPELINE DATA:\n{context}"
            )
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=system,
                messages=messages,
            )
            return ChatResponse(
                response=resp.content[0].text,
                sources=[],
                candidate_ids=_extract_ids(request.message, s),
            )
        except anthropic.APIConnectionError as exc:
            logger.warning("Anthropic connection error: %s — falling back to rule-based chat", exc)
        except anthropic.RateLimitError as exc:
            logger.warning("Anthropic rate limit: %s — falling back to rule-based chat", exc)
        except anthropic.APIStatusError as exc:
            logger.warning("Anthropic API error %s: %s — falling back to rule-based chat", exc.status_code, exc.message)
        except Exception as exc:
            logger.warning("Unexpected chat error: %s — falling back to rule-based chat", exc)
    return _rule_chat(request.message, s)


# ─── Candidate portal ──────────────────────────────────────────────────────────

@app.get("/api/portal/jobs")
def portal_jobs():
    """Return available job listings for the candidate portal."""
    from agents.job_understanding_agent import JD_TEXT, build
    jd = build()
    skills_flat = []
    for v in jd.must_have_skill_categories.values():
        skills_flat.extend(v[:3])

    return {
        "jobs": [
            {
                "id": "senior-ai-engineer-redrob",
                "title": jd.role,
                "company": jd.company,
                "location": ", ".join(jd.preferred_locations[:3]),
                "type": "Full-time",
                "experience_range": f"{jd.experience_min_years}–{jd.experience_max_years} years",
                "summary": jd.role_summary,
                "jd_text": JD_TEXT,
                "must_have_skills": jd.must_have_skill_categories,
                "nice_to_have_skills": jd.nice_to_have_skills,
                "top_skills": skills_flat[:10],
            }
        ]
    }


@app.post("/api/portal/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(
    resume_text: str = Form(...),
    job_id: str = Form("senior-ai-engineer-redrob"),
    custom_jd: Optional[str] = Form(None),
):
    from agents.job_understanding_agent import build, JD_TEXT
    from agents.jd_validator import JDValidator

    # Use custom JD if provided, else load stored JD
    if custom_jd and custom_jd.strip():
        initial = build()
        validator = JDValidator()
        result = validator.validate(custom_jd.strip(), initial)
        jd = result.corrected_profile
        must_have = jd.must_have_skill_categories
        nice_to_have = jd.nice_to_have_skills
    else:
        s = get_store()
        if s.ready:
            jd = s.jd
        else:
            jd = build()
        must_have = jd.must_have_skill_categories
        nice_to_have = jd.nice_to_have_skills

    text_lower = resume_text.lower()

    matched_skills, missing_skills = [], []
    for category, skills in must_have.items():
        category_matched = [sk for sk in skills if sk.lower() in text_lower]
        if category_matched:
            matched_skills.extend(category_matched[:2])
        else:
            missing_skills.append(skills[0] if skills else category)

    transferable = [sk for sk in nice_to_have if sk.lower() in text_lower]

    total_categories = max(len(must_have), 1)
    matched_categories = sum(
        1 for skills in must_have.values()
        if any(sk.lower() in text_lower for sk in skills)
    )
    match_score = round(matched_categories / total_categories, 2)

    strengths = [f"Demonstrated experience with {sk}" for sk in matched_skills[:5]]
    weaknesses = [f"No evidence of {sk}" for sk in missing_skills[:5]]

    # Context-aware suggestions based on what's missing
    suggestions = []
    if "rag" in " ".join(missing_skills).lower() or "retrieval" in " ".join(missing_skills).lower():
        suggestions.append("Build an end-to-end RAG pipeline: chunking → embedding → vector store → retrieval → generation")
    if "vector" in " ".join(missing_skills).lower() or "faiss" in " ".join(missing_skills).lower():
        suggestions.append("Publish a project using FAISS or Qdrant for semantic search with real datasets")
    if "fine.tun" in " ".join(missing_skills).lower() or "lora" in " ".join(missing_skills).lower():
        suggestions.append("Fine-tune a Hugging Face model with LoRA on a domain-specific dataset, measure BLEU/ROUGE")
    if len(suggestions) < 3:
        suggestions.append("Contribute to an open-source ML project to demonstrate collaborative engineering skills")
        suggestions.append("Write technical blog posts or case studies on production ML system design")

    projects = [
        "End-to-end RAG system: FAISS + sentence-transformers + FastAPI serving layer",
        "Hybrid search: BM25 + dense retrieval with NDCG@10 evaluation harness",
        "LLM fine-tuning: LoRA/QLoRA on domain data, tracked with MLflow",
        "Production semantic search microservice with async inference + monitoring",
    ]

    certs = [
        "DeepLearning.AI — LLMOps: Deploying AI Models in Production",
        "Hugging Face — NLP Course (free, recognized in the industry)",
        "Google Cloud — Professional Machine Learning Engineer",
        "MLflow Certified ML Engineer (Databricks)",
    ]

    # Adjust recommendations to missing areas
    missing_text = " ".join(missing_skills).lower()
    if "mlflow" in missing_text or "mlops" in missing_text:
        certs = [certs[0], "MLflow Certified ML Engineer (Databricks)"] + certs[2:]

    return {
        "match_score": match_score,
        "strengths": strengths if strengths else ["Resume received — no clear skill matches found against the JD"],
        "weaknesses": weaknesses,
        "transferable_skills": transferable[:6],
        "missing_skills": missing_skills[:6],
        "career_suggestions": suggestions[:3],
        "recommended_projects": projects[:3],
        "recommended_certifications": certs[:3],
        "estimated_improvement": round(min(1.0, match_score + 0.18), 2),
    }
