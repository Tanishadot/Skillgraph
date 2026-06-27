"""Pydantic response models — single source of truth for API contracts."""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ─── Candidate models ─────────────────────────────────────────────────────────

class SkillItem(BaseModel):
    name: str
    proficiency: str
    duration_months: int
    tier: int

class CareerEntry(BaseModel):
    title: str
    company: str
    duration_months: int
    description: str
    is_ai_role: bool
    start_year: Optional[int] = None

class ScoreBreakdown(BaseModel):
    experience: float
    projects: float
    semantic_match: float
    domain_fit: float
    behavior: float
    career_growth: float
    education: float
    certifications: float
    penalty: float

class BehaviorSignals(BaseModel):
    open_to_work: bool
    last_active_days: Optional[int] = None
    recruiter_response_rate: float
    interview_completion_rate: float
    notice_period_days: int
    github_activity_score: int

class EducationItem(BaseModel):
    degree: str
    field: str
    institution: str
    year: Optional[int] = None
    tier: int

class CandidateSummary(BaseModel):
    candidate_id: str
    rank: int
    overall_score: float
    confidence: float
    title: str
    experience_years: float
    ai_ml_years: float
    location: str
    notice_period_days: int
    is_hidden_gem: bool
    has_production_ml: bool
    recommendation: str
    reasoning: str
    top_skills: List[str]
    open_to_work: bool

class CandidateDetail(CandidateSummary):
    skills: List[SkillItem]
    career_history: List[CareerEntry]
    score_breakdown: ScoreBreakdown
    behavior_signals: BehaviorSignals
    education: List[EducationItem]
    certifications: List[str]
    headline: str
    summary: str
    consulting_only: bool
    is_honeypot: bool
    tier1_skills: List[str]
    tier2_skills: List[str]
    project_breakdown: Dict[str, Any]

class PaginatedCandidates(BaseModel):
    candidates: List[CandidateSummary]
    total: int
    page: int
    limit: int
    total_pages: int

class ComparisonItem(BaseModel):
    candidate_id: str
    rank: int
    title: str
    overall_score: float
    score_breakdown: ScoreBreakdown
    top_skills: List[str]
    experience_years: float
    ai_ml_years: float
    has_production_ml: bool
    notice_period_days: int
    location: str
    reasoning: str

class ComparisonResponse(BaseModel):
    candidates: List[ComparisonItem]
    winner_id: str
    analysis: str
    dimension_winners: Dict[str, str]


# ─── Dashboard / Analytics ────────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_candidates: int
    qualified_candidates: int
    interview_ready: int
    hidden_gems: int
    rejected: int
    avg_score: float
    avg_confidence: float
    avg_recruiter_response_rate: float
    honeypots_detected: int
    pipeline_ready: bool

class ChartPoint(BaseModel):
    label: str
    value: float
    count: Optional[int] = None
    color: Optional[str] = None

class FunnelStage(BaseModel):
    stage: str
    count: int
    percentage: float
    color: str

class AnalyticsResponse(BaseModel):
    score_distribution: List[ChartPoint]
    experience_distribution: List[ChartPoint]
    skill_distribution: List[ChartPoint]
    domain_distribution: List[ChartPoint]
    behavior_distribution: List[ChartPoint]
    funnel: List[FunnelStage]
    location_distribution: List[ChartPoint]
    notice_period_distribution: List[ChartPoint]


# ─── JD models ────────────────────────────────────────────────────────────────

class ExperienceIssue(BaseModel):
    technology: str
    requested_years: int
    max_plausible_years: int
    mainstream_year: int
    status: str
    reasoning: str
    suggested_range: str

class ContradictionIssue(BaseModel):
    contradiction_type: str
    signal_a: str
    signal_b: str
    explanation: str
    suggestion: str

class TransferableMapping(BaseModel):
    canonical_skill: str
    competency: str
    equivalents: List[str]

class MissingRequirement(BaseModel):
    field_name: str
    importance: str
    suggestion: str

class SkillOverload(BaseModel):
    total_skills: int
    complexity_score: float
    talent_availability: str
    recommendation: str
    priority_skills: List[str]
    optional_skills: List[str]
    by_category: Dict[str, List[str]]

class JDValidationResponse(BaseModel):
    jd_quality_score: float
    role: str
    company: str
    experience_issues: List[ExperienceIssue]
    contradictions: List[ContradictionIssue]
    skill_overload: Optional[SkillOverload]
    missing_requirements: List[MissingRequirement]
    transferable_mappings: List[TransferableMapping]
    improvements_applied: List[str]
    must_have_skills: Dict[str, List[str]]
    nice_to_have_skills: List[str]
    role_summary: str
    experience_min_years: int
    experience_max_years: int

class JDProfileResponse(BaseModel):
    role: str
    company: str
    role_summary: str
    must_have_skills: Dict[str, List[str]]
    nice_to_have_skills: List[str]
    experience_min_years: int
    experience_max_years: int
    preferred_locations: List[str]
    notice_period_ideal_days: int
    disqualifiers: List[str]


# ─── Chat models ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)

class ChatResponse(BaseModel):
    response: str
    sources: List[str] = Field(default_factory=list)
    candidate_ids: List[str] = Field(default_factory=list)


# ─── Candidate portal ─────────────────────────────────────────────────────────

class ResumeAnalysisResponse(BaseModel):
    match_score: float
    strengths: List[str]
    weaknesses: List[str]
    transferable_skills: List[str]
    missing_skills: List[str]
    career_suggestions: List[str]
    recommended_projects: List[str]
    recommended_certifications: List[str]
    estimated_improvement: float
