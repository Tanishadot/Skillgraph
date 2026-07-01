// ─── Candidate ────────────────────────────────────────────────────────────────

export interface SkillItem {
  name: string
  proficiency: 'expert' | 'advanced' | 'intermediate' | 'beginner'
  duration_months: number
  tier: 1 | 2 | 3
}

export interface CareerEntry {
  title: string
  company: string
  duration_months: number
  description: string
  is_ai_role: boolean
  start_year?: number | null
}

export interface ScoreBreakdown {
  experience: number
  projects: number
  semantic_match: number
  domain_fit: number
  behavior: number
  career_growth: number
  education: number
  certifications: number
  penalty: number
}

export interface BehaviorSignals {
  open_to_work: boolean
  last_active_days: number | null
  recruiter_response_rate: number
  interview_completion_rate: number
  notice_period_days: number
  github_activity_score: number
}

export interface EducationItem {
  degree: string
  field: string
  institution: string
  year?: number | null
  tier: number
}

export interface CandidateSummary {
  candidate_id: string
  rank: number
  overall_score: number
  confidence: number
  title: string
  experience_years: number
  ai_ml_years: number
  location: string
  notice_period_days: number
  is_hidden_gem: boolean
  has_production_ml: boolean
  recommendation: string
  reasoning: string
  top_skills: string[]
  open_to_work: boolean
}

export interface CandidateDetail extends CandidateSummary {
  skills: SkillItem[]
  career_history: CareerEntry[]
  score_breakdown: ScoreBreakdown
  behavior_signals: BehaviorSignals
  education: EducationItem[]
  certifications: string[]
  headline: string
  summary: string
  consulting_only: boolean
  is_honeypot: boolean
  tier1_skills: string[]
  tier2_skills: string[]
  project_breakdown: Record<string, number>
  semantic_score_estimated?: boolean
}

export interface PaginatedCandidates {
  candidates: CandidateSummary[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface ComparisonItem {
  candidate_id: string
  rank: number
  title: string
  overall_score: number
  score_breakdown: ScoreBreakdown
  top_skills: string[]
  experience_years: number
  ai_ml_years: number
  has_production_ml: boolean
  notice_period_days: number
  location: string
  reasoning: string
}

export interface ComparisonResponse {
  candidates: ComparisonItem[]
  winner_id: string
  analysis: string
  dimension_winners: Record<string, string>
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface StatsResponse {
  total_candidates: number
  qualified_candidates: number
  interview_ready: number
  hidden_gems: number
  rejected: number
  avg_score: number
  avg_confidence: number
  avg_recruiter_response_rate: number
  honeypots_detected: number
  pipeline_ready: boolean
}

export interface ChartPoint {
  label: string
  value: number
  count?: number
  color?: string
}

export interface FunnelStage {
  stage: string
  count: number
  percentage: number
  color: string
}

export interface AnalyticsResponse {
  score_distribution: ChartPoint[]
  experience_distribution: ChartPoint[]
  skill_distribution: ChartPoint[]
  domain_distribution: ChartPoint[]
  behavior_distribution: ChartPoint[]
  funnel: FunnelStage[]
  location_distribution: ChartPoint[]
  notice_period_distribution: ChartPoint[]
}

// ─── JD ───────────────────────────────────────────────────────────────────────

export interface ExperienceIssue {
  technology: string
  requested_years: number
  max_plausible_years: number
  mainstream_year: number
  status: 'Impossible' | 'Implausible' | 'Rare' | 'Valid'
  reasoning: string
  suggested_range: string
}

export interface ContradictionIssue {
  contradiction_type: string
  signal_a: string
  signal_b: string
  explanation: string
  suggestion: string
}

export interface TransferableMapping {
  canonical_skill: string
  competency: string
  equivalents: string[]
}

export interface MissingRequirement {
  field_name: string
  importance: 'critical' | 'recommended' | 'optional'
  suggestion: string
}

export interface SkillOverload {
  total_skills: number
  complexity_score: number
  talent_availability: 'high' | 'medium' | 'low' | 'critical'
  recommendation: string
  priority_skills: string[]
  optional_skills: string[]
  by_category: Record<string, string[]>
}

export interface JDValidationResponse {
  jd_quality_score: number
  role: string
  company: string
  experience_issues: ExperienceIssue[]
  contradictions: ContradictionIssue[]
  skill_overload: SkillOverload | null
  missing_requirements: MissingRequirement[]
  transferable_mappings: TransferableMapping[]
  improvements_applied: string[]
  must_have_skills: Record<string, string[]>
  nice_to_have_skills: string[]
  role_summary: string
  experience_min_years: number
  experience_max_years: number
}

export interface JDProfileResponse {
  role: string
  company: string
  role_summary: string
  must_have_skills: Record<string, string[]>
  nice_to_have_skills: string[]
  experience_min_years: number
  experience_max_years: number
  preferred_locations: string[]
  notice_period_ideal_days: number
  disqualifiers: string[]
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: string[]
  candidate_ids?: string[]
}

export interface ChatRequest {
  message: string
  history: Array<{ role: string; content: string; timestamp: string }>
}

export interface ChatResponse {
  response: string
  sources: string[]
  candidate_ids: string[]
}

// ─── Portal ───────────────────────────────────────────────────────────────────

export interface ResumeAnalysisResponse {
  match_score: number
  strengths: string[]
  weaknesses: string[]
  transferable_skills: string[]
  missing_skills: string[]
  career_suggestions: string[]
  recommended_projects: string[]
  recommended_certifications: string[]
  estimated_improvement: number
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface CandidateFilters {
  search?: string
  min_score?: number
  has_production_ml?: boolean
  open_to_work?: boolean
  hidden_gems_only?: boolean
  sort?: 'rank' | 'score' | 'experience' | 'ai_years'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}
