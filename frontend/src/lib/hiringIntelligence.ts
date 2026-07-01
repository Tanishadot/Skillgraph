/**
 * Hiring Decision Intelligence
 *
 * Transforms existing ranking scores into recruiter-oriented decision support.
 * No new models — all derived from existing backend outputs.
 */

import type { CandidateDetail, CandidateSummary, StatsResponse } from '@/types'

// ── Interview Recommendation ───────────────────────────────────────────────────

export interface InterviewRecommendation {
  label: string
  color: 'emerald' | 'violet' | 'blue' | 'amber' | 'zinc' | 'rose'
  description: string
}

export function interviewRecommendation(
  score: number,
  hasProductionML: boolean,
  isHiddenGem: boolean,
): InterviewRecommendation {
  if (score >= 0.82)
    return {
      label: 'Interview Immediately',
      color: 'emerald',
      description: 'Top-tier signal across all dimensions. Prioritise this candidate.',
    }
  if (score >= 0.74)
    return {
      label: 'Strong Interview',
      color: 'violet',
      description: 'Solid evidence across most areas. High likelihood of strong performance.',
    }
  if (score >= 0.66)
    return {
      label: 'Worth Validating',
      color: 'blue',
      description: 'Good technical alignment but some signals need verification.',
    }
  if (score >= 0.59 && (hasProductionML || isHiddenGem))
    return {
      label: 'High Potential',
      color: 'amber',
      description: 'Strong underlying signals. May be undervalued by conventional screening.',
    }
  if (score >= 0.52)
    return {
      label: 'Low Confidence',
      color: 'zinc',
      description: 'Insufficient evidence to make a strong recommendation either way.',
    }
  return {
    label: 'Not Recommended',
    color: 'rose',
    description: 'Significant gaps between role requirements and candidate evidence.',
  }
}

// ── Decision Summary ───────────────────────────────────────────────────────────

export function generateDecisionSummary(candidate: CandidateDetail): string {
  const sb = candidate.score_breakdown
  const rec = interviewRecommendation(
    candidate.overall_score,
    candidate.has_production_ml,
    candidate.is_hidden_gem,
  )

  // Identify strongest dimension (excluding penalty)
  const dimEntries = [
    { key: 'projects',       score: sb.projects,       label: 'production ML ownership' },
    { key: 'experience',     score: sb.experience,     label: 'experience depth' },
    { key: 'semantic_match', score: sb.semantic_match, label: 'semantic alignment with the role' },
    { key: 'domain_fit',     score: sb.domain_fit,     label: 'domain trajectory' },
    { key: 'behavior',       score: sb.behavior,       label: 'recruiter engagement signals' },
    { key: 'career_growth',  score: sb.career_growth,  label: 'career progression' },
  ].sort((a, b) => b.score - a.score)

  const top = dimEntries[0]
  const second = dimEntries[1]
  const weakest = dimEntries[dimEntries.length - 1]

  // Opening action line
  const actions: Record<string, string> = {
    'Interview Immediately': 'We recommend moving this candidate to interview immediately',
    'Strong Interview':      'We recommend scheduling an interview with this candidate',
    'Worth Validating':      'This candidate warrants a screening conversation',
    'High Potential':        'This candidate shows high potential worth exploring',
    'Low Confidence':        'Additional evidence is needed before proceeding',
    'Not Recommended':       'We do not recommend progressing this candidate at this stage',
  }
  const opening = actions[rec.label] ?? 'Review this candidate'

  // Reason clause
  const productionNote = candidate.has_production_ml
    ? 'backed by verified production ML deployment history'
    : 'though production deployment evidence is limited'
  const primaryReason = `${top.label} (${Math.round(top.score * 100)}), ${productionNote}`

  // Secondary strength
  const secondaryNote = second.score >= 0.7
    ? ` ${second.label} is also strong`
    : ''

  // Primary concern
  const concern = weakest.score < 0.55
    ? ` The primary area to validate is ${weakest.label}.`
    : ''

  // Behavioral note
  const behaviorNote = sb.behavior < 0.45
    ? ' Recruiter responsiveness is historically low — outreach timing matters.'
    : sb.behavior > 0.8
    ? ' Strong engagement signals suggest this candidate is actively reachable.'
    : ''

  // Notice note
  const noticeNote = candidate.notice_period_days > 60
    ? ` Note: ${candidate.notice_period_days}-day notice period requires planning.`
    : candidate.notice_period_days === 0
    ? ' Available immediately.'
    : ''

  return `${opening}, based on ${primaryReason}.${secondaryNote ? ` ${secondaryNote}.` : ''}${concern}${behaviorNote}${noticeNote}`
}

// ── Why This Candidate ─────────────────────────────────────────────────────────

export interface WhyReason {
  label: string
  detail: string
}

export function generateWhyThisCandidate(candidate: CandidateDetail): WhyReason[] {
  const sb = candidate.score_breakdown
  const reasons: WhyReason[] = []

  if (sb.projects >= 0.72)
    reasons.push({
      label: 'Production ML ownership',
      detail: candidate.has_production_ml
        ? 'Verified production deployments in career history, not just research or hobby projects.'
        : `Strong project depth score (${Math.round(sb.projects * 100)}) based on described complexity and scale.`,
    })

  if (sb.experience >= 0.75)
    reasons.push({
      label: 'Well-calibrated experience',
      detail: `${candidate.ai_ml_years.toFixed(1)} years of AI/ML-specific experience aligns closely with the role's 5–9 year sweet spot.`,
    })

  if (sb.semantic_match >= 0.70)
    reasons.push({
      label: 'Strong semantic alignment',
      detail: 'Resume language closely mirrors the technical framing of the job description — not keyword-matching, but conceptual alignment.',
    })

  if (sb.domain_fit >= 0.80)
    reasons.push({
      label: 'Consistent domain trajectory',
      detail: 'Career history shows a clear AI/ML engineering path without significant diversions into unrelated domains.',
    })

  if (sb.career_growth >= 0.80)
    reasons.push({
      label: 'Excellent career progression',
      detail: 'Seniority levels have clearly increased across roles, indicating recognized growth rather than lateral movement.',
    })

  if (sb.behavior >= 0.78)
    reasons.push({
      label: 'High behavioral engagement',
      detail: 'Strong recruiter responsiveness and engagement signals — high probability of meaningful response to outreach.',
    })

  if (candidate.is_hidden_gem)
    reasons.push({
      label: 'Undervalued by conventional screening',
      detail: 'High technical fit with limited recruiter contact history — a candidate conventional ATS systems would likely miss.',
    })

  return reasons.slice(0, 3)
}

// ── Tradeoffs ─────────────────────────────────────────────────────────────────

export interface Tradeoffs {
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  missingEvidence: string[]
  transferable: string[]
}

export function generateTradeoffs(candidate: CandidateDetail): Tradeoffs {
  const sb = candidate.score_breakdown
  const strengths: string[] = []
  const weaknesses: string[] = []
  const risks: string[] = []
  const missingEvidence: string[] = []
  const transferable: string[] = []

  // Strengths
  if (sb.projects >= 0.72)  strengths.push('Production ML deployment history')
  if (sb.experience >= 0.74) strengths.push(`${candidate.ai_ml_years.toFixed(1)}yr AI/ML-specific experience`)
  if (sb.semantic_match >= 0.70) strengths.push('Strong JD semantic alignment')
  if (sb.domain_fit >= 0.78) strengths.push('Consistent AI/ML career domain')
  if (sb.career_growth >= 0.80) strengths.push('Clear seniority progression')
  if (sb.behavior >= 0.75)  strengths.push('High recruiter engagement history')
  if (candidate.open_to_work) strengths.push('Actively open to new opportunities')
  if (candidate.tier1_skills.length >= 3) strengths.push(`${candidate.tier1_skills.length} core retrieval/ML skills (Tier 1)`)

  // Weaknesses
  if (sb.projects < 0.55)    weaknesses.push('Limited evidence of production-scale project ownership')
  if (sb.experience < 0.55)  weaknesses.push('Experience depth below the ideal range for this role')
  if (sb.semantic_match < 0.55) weaknesses.push('Limited overlap with role-specific technical vocabulary')
  if (sb.domain_fit < 0.55)  weaknesses.push('Career trajectory not fully aligned with AI/ML engineering')
  if (sb.career_growth < 0.50) weaknesses.push('Stagnant or inconsistent seniority progression')
  if (sb.education < 0.45)   weaknesses.push('Educational background not in a core technical field')
  if (sb.certifications < 0.35) weaknesses.push('No relevant ML/AI certifications on record')

  // Risks
  if (candidate.notice_period_days > 90)
    risks.push(`${candidate.notice_period_days}-day notice period — extended onboarding timeline`)
  if (candidate.behavior_signals.recruiter_response_rate < 0.30)
    risks.push('Historically low recruiter response rate — outreach may not convert')
  if (candidate.behavior_signals.last_active_days !== null && candidate.behavior_signals.last_active_days > 90)
    risks.push(`Last active ${candidate.behavior_signals.last_active_days} days ago — may no longer be in the market`)
  if (candidate.consulting_only)
    risks.push('Entire career has been in consulting environments — limited product engineering evidence')
  if (sb.penalty < 0.80)
    risks.push('Anomaly signals detected — profile consistency requires manual verification')

  // Missing Evidence
  if (!candidate.has_production_ml)
    missingEvidence.push('No verified production ML deployment in described experience')
  if (candidate.certifications.length === 0)
    missingEvidence.push('No ML/AI certifications listed')
  if (candidate.behavior_signals.github_activity_score < 0)
    missingEvidence.push('No GitHub activity linked — open-source contribution unknown')
  if (sb.career_growth < 0.65 && candidate.experience_years > 5)
    missingEvidence.push('Long tenure without clear seniority progression — reasons unclear from profile')

  // Transferable Experience
  const tier1Present = candidate.tier1_skills.filter((s) =>
    ['faiss', 'bm25', 'qdrant', 'milvus', 'weaviate', 'chroma'].some((v) => s.toLowerCase().includes(v))
  )
  if (tier1Present.length > 0 && sb.semantic_match < 0.65)
    transferable.push(
      `Has hands-on ${tier1Present.slice(0, 2).join(' and ')} experience — strong retrieval foundation despite vocabulary gap with JD.`
    )
  if (candidate.tier2_skills.some((s) => s.toLowerCase().includes('pytorch') || s.toLowerCase().includes('tensorflow')))
    transferable.push('Deep framework experience (PyTorch/TensorFlow) transfers directly to model fine-tuning requirements.')
  if (sb.experience > 0.75 && sb.domain_fit < 0.65)
    transferable.push('Strong general ML engineering background that can transfer to the retrieval specialization this role needs.')

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 4),
    risks: risks.slice(0, 3),
    missingEvidence: missingEvidence.slice(0, 4),
    transferable: transferable.slice(0, 3),
  }
}

// ── Interview Validation Areas ────────────────────────────────────────────────

export function generateValidationAreas(candidate: CandidateDetail): string[] {
  const sb = candidate.score_breakdown
  const areas: string[] = []

  // Only suggest areas where the score is uncertain (0.50–0.74) or signal is weak
  if (sb.projects >= 0.50 && sb.projects < 0.74)
    areas.push('Validate production ML ownership — ask for a specific system they built end-to-end and its real-world impact')

  if (!candidate.has_production_ml)
    areas.push('Validate production deployment experience — confirm whether described "deployed" work reached real users')

  if (sb.semantic_match >= 0.50 && sb.semantic_match < 0.72)
    areas.push('Validate retrieval system depth — explore their understanding of dense vs sparse retrieval and when to use each')

  if (sb.career_growth >= 0.40 && sb.career_growth < 0.75)
    areas.push('Validate engineering progression — confirm scope of ownership at each role, not just title changes')

  if (sb.experience < 0.70 && candidate.experience_years >= 5)
    areas.push('Validate AI/ML-specific experience — confirm years are in applied ML rather than adjacent analytics work')

  if (candidate.consulting_only)
    areas.push('Validate product engineering mindset — consulting backgrounds often lack exposure to iterative product ownership')

  if (candidate.tier1_skills.length < 2)
    areas.push('Validate retrieval stack knowledge — probe their practical experience with vector databases and evaluation metrics')

  if (sb.behavior < 0.55)
    areas.push('Validate current job search intent — confirm they are actively evaluating new opportunities')

  return areas.slice(0, 4)
}

// ── Opportunity Cost ───────────────────────────────────────────────────────────

export function generateOpportunityCost(candidate: CandidateDetail | CandidateSummary): string | null {
  const score = candidate.overall_score
  const hasProductionML = candidate.has_production_ml

  // Only compute for lower-ranked candidates where rejection is likely
  if (score >= 0.72) return null

  const det = candidate as CandidateDetail
  const tier1 = det.tier1_skills ?? []
  const tier2 = det.tier2_skills ?? []

  const hasStrongRetrieval = tier1.some((s) =>
    ['faiss', 'bm25', 'qdrant', 'milvus', 'weaviate', 'chroma', 'elasticsearch', 'opensearch'].some((v) =>
      s.toLowerCase().includes(v)
    )
  )
  const hasFineTuning = tier1.some((s) =>
    ['lora', 'qlora', 'peft', 'fine-tun', 'fine tuning', 'rlhf'].some((v) => s.toLowerCase().includes(v))
  )
  const hasCoreML = tier2.some((s) =>
    ['pytorch', 'tensorflow', 'hugging face', 'transformers'].some((v) => s.toLowerCase().includes(v))
  )

  if (hasStrongRetrieval && score < 0.70)
    return `This candidate has strong hands-on retrieval experience (${tier1.slice(0, 3).join(', ')}) that may be underrepresented in the overall score. Rejecting based on rank alone could exclude a capable retrieval engineer.`

  if (hasFineTuning && score < 0.68)
    return `Despite a lower overall score, this candidate shows evidence of LLM fine-tuning experience — a rare and high-signal skill for this role. Consider a targeted screening call.`

  if (hasProductionML && score < 0.68)
    return `Verified production ML experience is present despite the lower composite score. This signal is difficult to fake and worth a 30-minute technical screen.`

  if (hasCoreML && (det.experience_years ?? 0) > 6 && score < 0.65)
    return `${det.experience_years ?? 0} years of ML engineering experience with core framework proficiency. The scoring gap may reflect description quality rather than actual capability.`

  return null
}

// ── Dashboard Hiring Intelligence ─────────────────────────────────────────────

export interface HiringIntelligenceItem {
  severity: 'amber' | 'rose' | 'violet' | 'emerald'
  headline: string
  detail: string
  actionLabel?: string
  actionTo?: string
}

export function generateHiringIntelligence(
  stats: StatsResponse,
  topCandidates: CandidateSummary[],
): HiringIntelligenceItem[] {
  const items: HiringIntelligenceItem[] = []
  const total = topCandidates.length

  if (total === 0) return items

  // Hidden gem underrepresentation
  if (stats.hidden_gems > 0) {
    items.push({
      severity: 'amber',
      headline: `${stats.hidden_gems} high-fit candidate${stats.hidden_gems > 1 ? 's' : ''} have received minimal recruiter attention`,
      detail: `These candidates score above 0.63 with strong growth signals but low historical contact. Conventional ATS pipelines would likely miss them entirely.`,
      actionLabel: 'Review overlooked candidates',
      actionTo: '/hidden-talent',
    })
  }

  // Production ML density in shortlist
  const prodMLCount = topCandidates.filter((c) => c.has_production_ml).length
  const prodMLPct = Math.round((prodMLCount / total) * 100)
  if (prodMLPct < 60) {
    items.push({
      severity: 'rose',
      headline: `Only ${prodMLPct}% of shortlisted candidates have verified production ML deployments`,
      detail: `This role explicitly requires production experience. ${total - prodMLCount} candidates in the shortlist may lack real-world deployment evidence beyond research or coursework.`,
      actionLabel: 'Filter to Prod ML only',
      actionTo: '/rankings',
    })
  } else {
    items.push({
      severity: 'emerald',
      headline: `${prodMLPct}% of your shortlist has verified production ML experience`,
      detail: `The pipeline quality is strong — production evidence is the single hardest signal to inflate, and your top candidates have it.`,
    })
  }

  // Leadership gap
  if (stats.interview_ready > 5) {
    items.push({
      severity: 'violet',
      headline: 'Most top candidates show strong technical fit but limited leadership evidence',
      detail: `If this role requires founding team ownership and mentorship, shortlisting for a leadership signal interview is recommended — the current scoring prioritises technical depth over engineering leadership.`,
      actionLabel: 'Compare top candidates',
      actionTo: '/compare',
    })
  }

  // Equivalent technology breadth
  items.push({
    severity: 'amber',
    headline: 'Your JD may be excluding candidates with equivalent vector database experience',
    detail: `Candidates experienced with FAISS, Milvus, or Weaviate are functionally interchangeable with Pinecone-specific experience for most retrieval tasks. Rejecting on vendor-specific tooling narrows your pool without improving hire quality.`,
    actionLabel: 'Validate the JD',
    actionTo: '/jd-analysis',
  })

  // Response rate risk
  if (stats.avg_recruiter_response_rate < 0.5) {
    items.push({
      severity: 'rose',
      headline: 'Candidate engagement risk: low historical response rates across the pool',
      detail: `Average recruiter response rate is ${Math.round(stats.avg_recruiter_response_rate * 100)}%. Prioritise candidates marked "Open to Work" and those active within the last 30 days for first outreach.`,
    })
  }

  return items.slice(0, 4)
}
