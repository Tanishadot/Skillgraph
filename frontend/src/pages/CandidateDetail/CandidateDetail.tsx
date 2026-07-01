import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MapPin, Clock, Briefcase, GraduationCap, Award,
  CheckCircle2, AlertTriangle, Gem, Cpu, Brain, ChevronDown,
  ShieldCheck, ShieldAlert, Activity, TrendingUp,
} from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchCandidate } from '@/api/candidates'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { ScoreRing } from '@/components/common/ScoreRing'
import { ErrorState } from '@/components/common/ErrorState'
import {
  formatYears, formatDays, relativeTime, scoreColor, proficiencyColor,
  SCORE_LABELS, SCORE_WEIGHTS, scoreToHsl, cn,
} from '@/lib/utils'
import {
  interviewRecommendation,
  generateDecisionSummary,
  generateWhyThisCandidate,
  generateValidationAreas,
  generateTradeoffs,
  generateOpportunityCost,
} from '@/lib/hiringIntelligence'
import type { CandidateDetail as CandidateDetailType } from '@/types'

// ─── Dimension explanations ───────────────────────────────────────────────────

const DIM_EXPLAIN: Record<string, { what: string; weight: string }> = {
  projects:       { weight: '28%', what: 'Technical complexity, production ML deployments, GitHub activity, open-source contributions.' },
  experience:     { weight: '22%', what: 'Total years with peak weighting at 7yr, plus AI/ML-specific years scored separately.' },
  semantic_match: { weight: '20%', what: 'SBERT embedding similarity (all-MiniLM-L6-v2, 384-dim) between resume text and job description.' },
  domain_fit:     { weight: '12%', what: 'Title and career trajectory alignment with AI/ML engineering roles.' },
  behavior:       { weight: '8%',  what: 'Redrob signals: recruiter response rate, availability, notice period, days since active.' },
  career_growth:  { weight: '5%',  what: 'Seniority progression trajectory — IC growth vs consulting-only patterns.' },
  education:      { weight: '3%',  what: 'Degree tier and field relevance to ML/AI engineering.' },
  certifications: { weight: '2%',  what: 'Relevant ML/AI certifications from recognized providers.' },
}

const RADAR_DIMS = [
  { key: 'experience',     label: 'Experience' },
  { key: 'projects',       label: 'Projects'   },
  { key: 'semantic_match', label: 'Semantic'   },
  { key: 'domain_fit',     label: 'Domain'     },
  { key: 'behavior',       label: 'Behavior'   },
  { key: 'career_growth',  label: 'Growth'     },
]

// ─── Avatar Initials ──────────────────────────────────────────────────────────

function Initials({ title, size = 56 }: { title: string; size?: number }) {
  const words = title.trim().split(/\s+/)
  const a = words[0]?.[0] ?? ''
  const b = words[1]?.[0] ?? ''
  return (
    <div
      className="rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-violet-300 uppercase" style={{ fontSize: Math.round(size * 0.28) }}>
        {a}{b}
      </span>
    </div>
  )
}

// ─── Expandable Score Row ─────────────────────────────────────────────────────

function ScoreRow({
  dimKey, label, value, weight, isActive, onClick,
}: {
  dimKey: string; label: string; value: number; weight: number; isActive: boolean; onClick: () => void
}) {
  const explain = DIM_EXPLAIN[dimKey]
  return (
    <div>
      <button onClick={onClick} className="w-full group" aria-expanded={isActive}>
        <div className="flex items-center justify-between mb-1.5 py-1 px-1 rounded-lg hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-2">
            <ChevronDown className={cn('w-3 h-3 text-zinc-600 transition-transform duration-200', isActive && 'rotate-180 text-violet-400')} />
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">w={weight.toFixed(2)}</span>
            <span className={`text-xs font-semibold tabular-nums ${scoreColor(value)}`}>
              {(value * 100).toFixed(0)}
            </span>
          </div>
        </div>
        <Progress value={value} height={3} color={scoreToHsl(value)} />
      </button>

      <AnimatePresence>
        {isActive && explain && (
          <motion.div
            key="expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 mb-3 ml-5 px-3 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/15">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Weight</span>
                <span className="text-[10px] text-zinc-300 font-mono">{explain.weight}</span>
                <span className="text-[10px] text-zinc-600">of overall score</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{explain.what}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value * 100}%`, backgroundColor: scoreToHsl(value) }}
                  />
                </div>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreToHsl(value) }}>
                  {(value * 100).toFixed(1)} / 100
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Hiring Risk ──────────────────────────────────────────────────────────────

function HiringRisk({ candidate }: { candidate: CandidateDetailType }) {
  const bs = candidate.behavior_signals
  if (bs.recruiter_response_rate < 0.3) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span className="text-xs text-rose-400">High contact risk — low historical response rate</span>
      </div>
    )
  }
  if (candidate.notice_period_days > 60) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-400">Long notice period — plan for extended onboarding lead time</span>
      </div>
    )
  }
  if (bs.open_to_work) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-400">Actively looking — likely to respond quickly</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
      <Activity className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <span className="text-xs text-zinc-500">Passive candidate — outreach timing matters</span>
    </div>
  )
}

// ─── CandidateDetail ──────────────────────────────────────────────────────────

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeDim, setActiveDim] = useState<string | null>(null)

  const { data: candidate, isLoading, error } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => fetchCandidate(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl col-span-2" />
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return <div className="p-6"><ErrorState message="Candidate not found in top-100" /></div>
  }

  const sb = candidate.score_breakdown
  const radarData = RADAR_DIMS.map(({ key, label }) => ({
    subject: label,
    value: Math.round(((sb as unknown as Record<string, number>)[key] ?? 0) * 100),
  }))

  const toggleDim = (key: string) => setActiveDim((prev) => (prev === key ? null : key))

  const projectEntries = Object.entries(candidate.project_breakdown ?? {}).filter(
    ([, v]) => typeof v === 'number' && (v as number) > 0
  ) as [string, number][]

  const hiRec          = interviewRecommendation(candidate.overall_score, candidate.has_production_ml, candidate.is_hidden_gem)
  const decisionSummary   = generateDecisionSummary(candidate)
  const whyReasons        = generateWhyThisCandidate(candidate)
  const validationAreas   = generateValidationAreas(candidate)
  const tradeoffs         = generateTradeoffs(candidate)
  const opportunityCost   = generateOpportunityCost(candidate)

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Link
        to="/rankings"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rankings
      </Link>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-6 mb-4"
      >
        <div className="flex items-start gap-5">
          <Initials title={candidate.title} size={60} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-lg font-semibold text-white">{candidate.title}</h1>
              <span className="text-xs text-zinc-500 font-mono">#{candidate.rank}</span>
              {candidate.has_production_ml && <Badge variant="emerald">Prod ML</Badge>}
              {candidate.is_hidden_gem && <Badge variant="amber"><Gem className="w-3 h-3 mr-1" />Hidden Gem</Badge>}
              {candidate.is_honeypot && <Badge variant="rose"><AlertTriangle className="w-3 h-3 mr-1" />Honeypot</Badge>}
              {candidate.consulting_only && <Badge variant="zinc">Consulting Only</Badge>}
              {(() => {
                const rec = interviewRecommendation(candidate.overall_score, candidate.has_production_ml, candidate.is_hidden_gem)
                return <Badge variant={rec.color}>{rec.label}</Badge>
              })()}
            </div>
            {candidate.headline && (
              <p className="text-sm text-zinc-400 mb-2">{candidate.headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{candidate.location}</span>
              <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />{formatYears(candidate.ai_ml_years)} AI/ML</span>
              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{formatYears(candidate.experience_years)} total</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDays(candidate.notice_period_days)} notice</span>
              {candidate.open_to_work && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />Open to work
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <ScoreRing score={candidate.overall_score} size={80} strokeWidth={5} />
            <p className="text-[10px] text-zinc-600">Penalty ×{candidate.score_breakdown.penalty.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <p className="text-xs text-zinc-400 leading-relaxed italic">{candidate.reasoning}</p>
        </div>
      </motion.div>

      {/* ── Decision Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07, duration: 0.4 }}
        className="mb-4"
      >
        <Card className="p-5">
          <div className="flex flex-col gap-4">
            {/* Recommendation + Summary */}
            <div className="flex items-start gap-5">
              <div className="shrink-0 min-w-[140px]">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Recruiter Recommendation</p>
                <Badge variant={hiRec.color} className="text-sm px-3 py-1 font-semibold block w-fit">{hiRec.label}</Badge>
                <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed max-w-[160px]">{hiRec.description}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Decision Summary</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{decisionSummary}</p>
              </div>
            </div>

            {/* Why This Candidate + Validate in Interview */}
            {(whyReasons.length > 0 || validationAreas.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-white/[0.05]">
                {whyReasons.length > 0 && (
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2.5">Why This Candidate</p>
                    <div className="space-y-2.5">
                      {whyReasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-zinc-300">{reason.label}</p>
                            <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{reason.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {validationAreas.length > 0 && (
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2.5">Validate in Interview</p>
                    <div className="space-y-2.5">
                      {validationAreas.map((area, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{area}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: Scores + Radar + Project breakdown */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Score Breakdown</p>
            <p className="text-[10px] text-zinc-600 mb-4">Click any dimension to expand explanation</p>
            <div className="space-y-3">
              {Object.entries(SCORE_LABELS).map(([key, label]) => (
                <ScoreRow
                  key={key}
                  dimKey={key}
                  label={label}
                  value={(sb as unknown as Record<string, number>)[key] ?? 0}
                  weight={SCORE_WEIGHTS[key] ?? 0}
                  isActive={activeDim === key}
                  onClick={() => toggleDim(key)}
                />
              ))}
            </div>
            {candidate.semantic_score_estimated && (
              <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed border-t border-white/[0.04] pt-3">
                * Semantic Match shown is the estimated contribution back-calculated from the pipeline output.
                Raw cosine similarity is stored in the ranking CSV.
              </p>
            )}
            <div className="mt-5 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#52525b', fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.18} strokeWidth={1.5} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v}`, '']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {projectEntries.length > 0 && (
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Project Signals</p>
              <div className="space-y-2.5">
                {projectEntries.slice(0, 6).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-zinc-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className={scoreColor(val)}>{(val * 100).toFixed(0)}</span>
                    </div>
                    <Progress value={val} height={3} color={scoreToHsl(val)} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tradeoffs */}
          {(tradeoffs.strengths.length > 0 || tradeoffs.weaknesses.length > 0 || tradeoffs.risks.length > 0) && (
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Tradeoffs</p>
              <div className="space-y-4">
                {tradeoffs.strengths.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Strengths</p>
                    </div>
                    <ul className="space-y-1">
                      {tradeoffs.strengths.map((s, i) => (
                        <li key={i} className="text-[11px] text-zinc-400 pl-3.5 relative before:absolute before:left-1 before:top-[5px] before:w-1 before:h-1 before:rounded-full before:bg-emerald-500/60">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tradeoffs.weaknesses.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Gaps</p>
                    </div>
                    <ul className="space-y-1">
                      {tradeoffs.weaknesses.map((s, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 pl-3.5 relative before:absolute before:left-1 before:top-[5px] before:w-1 before:h-1 before:rounded-full before:bg-amber-400/60">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tradeoffs.risks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Risks</p>
                    </div>
                    <ul className="space-y-1">
                      {tradeoffs.risks.map((s, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 pl-3.5 relative before:absolute before:left-1 before:top-[5px] before:w-1 before:h-1 before:rounded-full before:bg-rose-400/60">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right 2 cols */}
        <div className="lg:col-span-2 space-y-4">

          {/* Skills */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.length > 0
                ? candidate.skills.map((sk) => (
                    <span
                      key={sk.name}
                      className={`text-xs px-2.5 py-1 rounded-full border ${proficiencyColor(sk.proficiency)}`}
                    >
                      {sk.name}
                      {sk.duration_months > 0 && (
                        <span className="ml-1 opacity-50">{formatYears(sk.duration_months / 12)}</span>
                      )}
                    </span>
                  ))
                : candidate.top_skills.map((sk) => (
                    <span key={sk} className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] text-zinc-300">
                      {sk}
                    </span>
                  ))}
            </div>
          </Card>

          {/* Career Timeline */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Career Timeline</p>
            {candidate.career_history.length > 0 ? (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />
                <div className="space-y-4">
                  {candidate.career_history.map((entry, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 ${
                          entry.is_ai_role
                            ? 'bg-violet-600 border-violet-400'
                            : 'bg-zinc-700 border-zinc-600'
                        }`} />
                        {entry.start_year && (
                          <span className="text-[9px] text-zinc-700 mt-1 font-mono">{entry.start_year}</span>
                        )}
                      </div>
                      <div className="flex-1 pb-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 leading-tight">{entry.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{entry.company}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-zinc-500">{formatYears(entry.duration_months / 12)}</p>
                            {entry.is_ai_role && <Badge variant="violet" className="mt-1">AI Role</Badge>}
                          </div>
                        </div>
                        {entry.description && (
                          <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Career details not available</p>
            )}
          </Card>

          {/* Education + Behavior */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Education</p>
              {candidate.education.length > 0 ? (
                <div className="space-y-2.5">
                  {candidate.education.map((ed, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-zinc-300">{ed.degree}</p>
                        <p className="text-[11px] text-zinc-500">{ed.field}</p>
                        <p className="text-[11px] text-zinc-600">{ed.institution}{ed.year ? `, ${ed.year}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">Not available</p>
              )}
              {candidate.certifications.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.05]">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Certifications</p>
                  {candidate.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1.5">
                      <Award className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-[11px] text-zinc-400 leading-tight">{cert}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Behavior Signals</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Response Rate',  val: candidate.behavior_signals.recruiter_response_rate },
                  { label: 'Interview Rate', val: candidate.behavior_signals.interview_completion_rate },
                  {
                    label: 'GitHub Activity',
                    val: candidate.behavior_signals.github_activity_score > 0
                      ? candidate.behavior_signals.github_activity_score / 100
                      : null,
                  },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{label}</span>
                      <span className={val !== null ? scoreColor(val) : 'text-zinc-600'}>
                        {val !== null ? `${Math.round(val * 100)}%` : 'N/A'}
                      </span>
                    </div>
                    {val !== null && <Progress value={val} height={3} color={scoreToHsl(val)} />}
                  </div>
                ))}
                <div className="pt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Last active</span>
                    <span className="text-zinc-400">{relativeTime(candidate.behavior_signals.last_active_days)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Notice period</span>
                    <span className="text-zinc-400">{formatDays(candidate.notice_period_days)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Open to work</span>
                    <span className={candidate.open_to_work ? 'text-emerald-400' : 'text-zinc-500'}>
                      {candidate.open_to_work ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              <HiringRisk candidate={candidate} />
            </Card>
          </div>

          {/* AI Explanation */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-violet-400" />
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Ranking Evidence</p>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{candidate.reasoning}</p>
            {candidate.tier1_skills?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.05]">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Core Skills Matched (Tier 1)</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.tier1_skills.slice(0, 10).map((sk) => (
                    <Badge key={sk} variant="violet">{sk}</Badge>
                  ))}
                </div>
              </div>
            )}
            {candidate.tier2_skills?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Preferred Skills Matched (Tier 2)</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.tier2_skills.slice(0, 8).map((sk) => (
                    <Badge key={sk} variant="zinc">{sk}</Badge>
                  ))}
                </div>
              </div>
            )}
            {opportunityCost && (
              <div className="mt-4 pt-4 border-t border-white/[0.05]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Opportunity Cost of Rejection</p>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{opportunityCost}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
