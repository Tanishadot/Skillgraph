import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Users, Gem, AlertTriangle, ArrowRight,
  CheckCircle2, Clock, MapPin, Cpu, Brain, MessageSquare,
  GitCompare, FileText, Sparkles, ShieldAlert, Briefcase,
} from 'lucide-react'
import { fetchStats } from '@/api/analytics'
import { fetchCandidates } from '@/api/candidates'
import { fetchJDProfile } from '@/api/jd'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'
import { ScoreRing } from '@/components/common/ScoreRing'
import { ErrorState } from '@/components/common/ErrorState'
import { formatYears, formatDays, scoreBg } from '@/lib/utils'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'violet',
  delay = 0,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub?: string
  color?: 'violet' | 'emerald' | 'amber' | 'rose'
  delay?: number
}) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="p-5 h-full">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-white tabular-nums">
              <AnimatedCounter to={value} />
            </p>
            {sub && <p className="text-xs text-zinc-600 mt-1.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Insight Card ──────────────────────────────────────────────────────────────

interface InsightCardProps {
  icon: React.ElementType
  severity: 'amber' | 'rose' | 'violet' | 'emerald'
  headline: string
  sub: string
  actionLabel?: string
  actionTo?: string
}

function InsightCard({ icon: Icon, severity, headline, sub, actionLabel, actionTo }: InsightCardProps) {
  const colors: Record<string, { dot: string; icon: string; border: string; bg: string; btn: string }> = {
    amber:   { dot: 'bg-amber-400',   icon: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.06]',   btn: 'text-amber-300 hover:text-amber-200' },
    rose:    { dot: 'bg-rose-400',    icon: 'text-rose-400',    border: 'border-rose-500/20',    bg: 'bg-rose-500/[0.06]',    btn: 'text-rose-300 hover:text-rose-200'   },
    violet:  { dot: 'bg-violet-400',  icon: 'text-violet-400',  border: 'border-violet-500/20',  bg: 'bg-violet-500/[0.06]',  btn: 'text-violet-300 hover:text-violet-200' },
    emerald: { dot: 'bg-emerald-400', icon: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.06]', btn: 'text-emerald-300 hover:text-emerald-200' },
  }
  const c = colors[severity]
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${c.border} ${c.bg}`}>
      <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${c.icon}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
          <p className="text-xs font-semibold text-zinc-200 leading-snug">{headline}</p>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{sub}</p>
        {actionLabel && actionTo && (
          <Link
            to={actionTo}
            className={`inline-flex items-center gap-1 text-[11px] font-medium mt-2 transition-colors ${c.btn}`}
          >
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Quick Action Card ─────────────────────────────────────────────────────────

function QuickAction({
  to,
  icon: Icon,
  label,
  sub,
  color,
}: {
  to: string
  icon: React.ElementType
  label: string
  sub: string
  color: 'violet' | 'amber' | 'blue' | 'emerald'
}) {
  const colors: Record<string, string> = {
    violet:  'text-violet-400  group-hover:text-violet-300',
    amber:   'text-amber-400   group-hover:text-amber-300',
    blue:    'text-blue-400    group-hover:text-blue-300',
    emerald: 'text-emerald-400 group-hover:text-emerald-300',
  }
  return (
    <Link to={to} className="block group">
      <Card hover className="p-4 h-full">
        <CardContent className="p-0">
          <Icon className={`w-5 h-5 mb-2.5 transition-colors ${colors[color]}`} />
          <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{label}</p>
          <p className="text-xs text-zinc-600 mt-0.5 leading-snug">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Avatar Initials ───────────────────────────────────────────────────────────

function Initials({ title }: { title: string }) {
  const words = title.trim().split(/\s+/)
  const a = words[0]?.[0] ?? ''
  const b = words[1]?.[0] ?? ''
  return (
    <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-violet-300 uppercase">{a}{b}</span>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  })

  const { data: topCandidates, isLoading: topLoading } = useQuery({
    queryKey: ['candidates', { page: 1, limit: 5 }],
    queryFn: () => fetchCandidates({ page: 1, limit: 5 }),
  })

  const { data: jdProfile, isLoading: jdLoading } = useQuery({
    queryKey: ['jd-profile'],
    queryFn: fetchJDProfile,
  })

  if (statsError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Backend not reachable"
          message="Make sure the FastAPI server is running: uvicorn api.server:app --reload --port 8080"
        />
      </div>
    )
  }

  // Build AI Insights from live stats
  const insights: InsightCardProps[] = []
  if (stats) {
    if (stats.hidden_gems > 0) {
      insights.push({
        icon: Gem,
        severity: 'amber',
        headline: `${stats.hidden_gems} hidden gem${stats.hidden_gems !== 1 ? 's' : ''} found`,
        sub: 'Strong technical fit but low recruiter visibility — high signal, low noise candidates.',
        actionLabel: 'Review Gems',
        actionTo: '/hidden-talent',
      })
    }
    if (stats.honeypots_detected > 20) {
      insights.push({
        icon: ShieldAlert,
        severity: 'rose',
        headline: `${stats.honeypots_detected} suspicious profiles filtered automatically`,
        sub: 'AI flagged inflated experience, keyword-stuffing, and inconsistent career signals.',
      })
    }
    if (stats.interview_ready < 15) {
      insights.push({
        icon: Sparkles,
        severity: 'violet',
        headline: `Pipeline is competitive — only ${stats.interview_ready} candidates meet interview threshold`,
        sub: 'Score ≥ 0.70 with strong semantic match and production ML experience.',
      })
    }
    if (stats.avg_recruiter_response_rate < 0.5) {
      insights.push({
        icon: AlertTriangle,
        severity: 'amber',
        headline: 'Low recruiter engagement detected in the candidate pool',
        sub: `Avg response rate is ${Math.round(stats.avg_recruiter_response_rate * 100)}% — outreach timing and messaging may need optimization.`,
      })
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">

      {/* ── Campaign Header ── */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ duration: 0.4 }}>
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {jdLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-72" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : jdProfile ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-white">{jdProfile.role}</h1>
                    <Badge variant="emerald">Hiring Now</Badge>
                    {stats && stats.avg_score > 0.7 && (
                      <Badge variant="violet">Healthy Pipeline</Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-3">{jdProfile.company}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      {jdProfile.experience_min_years}–{jdProfile.experience_max_years} years exp
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Notice ideal: {formatDays(jdProfile.notice_period_ideal_days)}
                    </span>
                    {jdProfile.preferred_locations.slice(0, 3).map((loc) => (
                      <span key={loc} className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {loc}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-white">Candidate Intelligence Dashboard</h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    {stats
                      ? `${stats.total_candidates.toLocaleString()} applicants screened · ${stats.interview_ready} interview-ready · ${stats.hidden_gems} hidden gems`
                      : 'AI-powered candidate ranking pipeline'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── AI Insights ── */}
      {(stats && insights.length > 0) && (
        <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.1, duration: 0.4 }}>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-violet-400" />
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">AI Insights</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {insights.map((ins, i) => (
                <InsightCard key={i} {...ins} />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions ── */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.15, duration: 0.4 }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction to="/jd-analysis"    icon={FileText}      label="Analyze JD"         sub="Validate & improve your job description"  color="violet" />
          <QuickAction to="/hidden-talent"  icon={Gem}           label="Find Hidden Gems"   sub="Overlooked strong-fit candidates"         color="amber" />
          <QuickAction to="/compare"        icon={GitCompare}    label="Compare Top Picks"  sub="Side-by-side candidate comparison"        color="blue" />
          <QuickAction to="/chat"           icon={MessageSquare} label="Ask AI Copilot"     sub="Ask anything about your pipeline"        color="emerald" />
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)
        ) : stats ? (
          <>
            <StatCard icon={Users}         label="Total Screened"  value={stats.total_candidates}   color="violet"  delay={0}    sub="from candidate pool" />
            <StatCard icon={CheckCircle2}  label="Interview Ready" value={stats.interview_ready}     color="emerald" delay={0.05} sub="score ≥ 0.70" />
            <StatCard icon={Gem}           label="Hidden Gems"     value={stats.hidden_gems}         color="amber"   delay={0.1}  sub="low visibility, high fit" />
            <StatCard icon={AlertTriangle} label="Honeypots"       value={stats.honeypots_detected}  color="rose"    delay={0.15} sub="flagged / removed" />
          </>
        ) : null}
      </div>

      {/* ── Pipeline + Top Candidates ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Quality */}
        {stats && (
          <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
            <Card className="h-full p-5">
              <p className="text-xs text-zinc-500 mb-4 font-medium uppercase tracking-wider">Pipeline Quality</p>
              <div className="flex items-center justify-around py-2">
                <ScoreRing score={stats.avg_score} label="Avg Match" size={88} />
                <ScoreRing score={stats.avg_recruiter_response_rate} label="Response Rate" size={88} />
                <ScoreRing
                  score={stats.total_candidates > 0 ? stats.qualified_candidates / stats.total_candidates : 0}
                  label="Qualified %"
                  size={88}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Qualified', value: stats.qualified_candidates, of: stats.total_candidates },
                  { label: 'Interview', value: stats.interview_ready,      of: stats.total_candidates },
                  { label: 'Rejected',  value: stats.rejected,             of: stats.total_candidates },
                ].map(({ label, value, of }) => (
                  <div key={label}>
                    <p className="text-base font-bold text-white">{value}</p>
                    <p className="text-[10px] text-zinc-600">{label}</p>
                    <p className="text-[10px] text-zinc-700">
                      {of > 0 ? Math.round((value / of) * 100) : 0}%
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Top 5 Candidates */}
        <div className="lg:col-span-2">
          <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.25 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Top Candidates</p>
                <Link
                  to="/rankings"
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {topLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {topCandidates?.candidates.map((c) => (
                    <Link
                      key={c.candidate_id}
                      to={`/candidates/${c.candidate_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
                    >
                      <Initials title={c.title} />

                      <span className="w-6 text-right text-xs text-zinc-600 font-mono shrink-0">
                        #{c.rank}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                          {c.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Cpu className="w-3 h-3" />
                            {formatYears(c.ai_ml_years)} AI/ML
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <MapPin className="w-3 h-3" />
                            {c.location.split(',')[0]}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Clock className="w-3 h-3" />
                            {formatDays(c.notice_period_days)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.has_production_ml && <Badge variant="emerald">Prod ML</Badge>}
                        {c.is_hidden_gem && <Badge variant="amber">Gem</Badge>}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${scoreBg(c.overall_score)}`}>
                          {(c.overall_score * 100).toFixed(1)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

