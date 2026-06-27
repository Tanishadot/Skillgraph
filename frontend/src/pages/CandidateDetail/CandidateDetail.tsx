import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, MapPin, Clock, Briefcase, GraduationCap, Award,
  CheckCircle2, AlertTriangle, Gem, ChevronRight, Cpu,
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
  SCORE_LABELS, SCORE_WEIGHTS, scoreToHsl,
} from '@/lib/utils'

const RADAR_DIMS = [
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'semantic_match', label: 'Semantic' },
  { key: 'domain_fit', label: 'Domain' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'career_growth', label: 'Growth' },
]

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>()

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
    value: Math.round(((sb as any)[key] ?? 0) * 100),
  }))

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Back */}
      <Link
        to="/rankings"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rankings
      </Link>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-6 mb-4"
      >
        <div className="flex items-start gap-5">
          <ScoreRing score={candidate.overall_score} size={90} strokeWidth={6} />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-lg font-semibold text-white">{candidate.title}</h1>
              <span className="text-xs text-zinc-500 font-mono">#{candidate.rank}</span>
              {candidate.has_production_ml && <Badge variant="emerald">Prod ML</Badge>}
              {candidate.is_hidden_gem && <Badge variant="amber"><Gem className="w-3 h-3 mr-1" />Hidden Gem</Badge>}
              {candidate.is_honeypot && <Badge variant="rose"><AlertTriangle className="w-3 h-3 mr-1" />Honeypot</Badge>}
              {candidate.consulting_only && <Badge variant="zinc">Consulting Only</Badge>}
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
                <span className="flex items-center gap-1 text-violet-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />Open to work
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-bold tabular-nums ${scoreColor(candidate.overall_score)}`}>
              {(candidate.overall_score * 100).toFixed(1)}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">overall score</p>
            <p className="text-xs text-zinc-500 mt-2">
              Penalty: ×{candidate.score_breakdown.penalty.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <p className="text-xs text-zinc-400 leading-relaxed">{candidate.reasoning}</p>
        </div>
      </motion.div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scores + Radar */}
        <Card className="p-5">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Score Breakdown</p>
          <div className="space-y-2.5">
            {Object.entries(SCORE_LABELS).map(([key, label]) => {
              const val = (sb as any)[key] ?? 0
              const w = SCORE_WEIGHTS[key] ?? 0
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600">w={w.toFixed(2)}</span>
                      <span className={`text-xs font-medium tabular-nums ${scoreColor(val)}`}>
                        {(val * 100).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={val}
                    height={3}
                    color={scoreToHsl(val)}
                    trackClassName=""
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-5 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#52525b', fontSize: 10 }} />
                <Radar
                  dataKey="value"
                  stroke="#a78bfa"
                  fill="#a78bfa"
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}`, '']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Skills + Career */}
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
                        <span className="ml-1 opacity-60">{formatYears(sk.duration_months / 12)}</span>
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

          {/* Career */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Career History</p>
            {candidate.career_history.length > 0 ? (
              <div className="space-y-3">
                {candidate.career_history.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${entry.is_ai_role ? 'bg-violet-500' : 'bg-zinc-600'}`} />
                      {i < candidate.career_history.length - 1 && (
                        <div className="w-px flex-1 bg-white/[0.05] my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{entry.title}</p>
                          <p className="text-xs text-zinc-500">{entry.company}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs text-zinc-500">{formatYears(entry.duration_months / 12)}</p>
                          {entry.is_ai_role && <Badge variant="violet" size="sm">AI</Badge>}
                        </div>
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed line-clamp-2">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Career details not available</p>
            )}
          </Card>

          {/* Education + Behavior */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Education</p>
              {candidate.education.length > 0 ? (
                <div className="space-y-2">
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
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <Award className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-zinc-400">{cert}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Behavior Signals</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Response Rate', val: candidate.behavior_signals.recruiter_response_rate },
                  { label: 'Interview Rate', val: candidate.behavior_signals.interview_completion_rate },
                  { label: 'GitHub Activity', val: candidate.behavior_signals.github_activity_score > 0 ? candidate.behavior_signals.github_activity_score : null },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{label}</span>
                      <span className={val !== null ? scoreColor(val) : 'text-zinc-600'}>
                        {val !== null ? `${Math.round(val * 100)}%` : 'N/A'}
                      </span>
                    </div>
                    {val !== null && (
                      <Progress value={val} height={3} color={scoreToHsl(val)} />
                    )}
                  </div>
                ))}
                <div className="pt-1 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Last active</span>
                    <span className="text-zinc-400">{relativeTime(candidate.behavior_signals.last_active_days)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Notice period</span>
                    <span className="text-zinc-400">{formatDays(candidate.notice_period_days)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
