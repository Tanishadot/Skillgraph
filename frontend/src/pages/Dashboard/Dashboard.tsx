import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Users, Award, Gem, TrendingUp, AlertTriangle, ArrowRight,
  CheckCircle2, Clock, MapPin, Cpu,
} from 'lucide-react'
import { fetchStats } from '@/api/analytics'
import { fetchCandidates } from '@/api/candidates'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'
import { ScoreRing } from '@/components/common/ScoreRing'
import { ErrorState } from '@/components/common/ErrorState'
import { formatYears, formatDays, scoreBg, truncate } from '@/lib/utils'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

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
    >
      <Card className="p-5 h-full">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-2">{label}</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              <AnimatedCounter to={value} />
            </p>
            {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  })

  const { data: topCandidates, isLoading: topLoading } = useQuery({
    queryKey: ['candidates', { page: 1, limit: 5 }],
    queryFn: () => fetchCandidates({ page: 1, limit: 5 }),
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

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="mb-6">
        <h1 className="text-xl font-semibold text-white">Candidate Intelligence Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {stats
            ? `${stats.total_candidates.toLocaleString()} applicants screened · ${stats.interview_ready} interview-ready · ${stats.hidden_gems} hidden gems`
            : 'AI-powered candidate ranking pipeline'}
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : stats ? (
          <>
            <StatCard icon={Users} label="Total Screened" value={stats.total_candidates} color="violet" delay={0} sub="from candidate pool" />
            <StatCard icon={CheckCircle2} label="Interview Ready" value={stats.interview_ready} color="emerald" delay={0.05} sub="score ≥ 0.70" />
            <StatCard icon={Gem} label="Hidden Gems" value={stats.hidden_gems} color="amber" delay={0.1} sub="low visibility, high fit" />
            <StatCard icon={AlertTriangle} label="Honeypots" value={stats.honeypots_detected} color="rose" delay={0.15} sub="flagged / removed" />
          </>
        ) : null}
      </div>

      {/* Pipeline overview + top 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline quality */}
        {stats && (
          <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
            <Card className="h-full p-5">
              <p className="text-xs text-zinc-500 mb-4 font-medium uppercase tracking-wider">Pipeline Quality</p>
              <div className="flex items-center justify-around py-2">
                <ScoreRing score={stats.avg_score} label="Avg Score" size={88} />
                <ScoreRing score={stats.avg_recruiter_response_rate} label="Response Rate" size={88} />
                <ScoreRing score={stats.qualified_candidates / stats.total_candidates} label="Qualified %" size={88} />
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Qualified', value: stats.qualified_candidates, of: stats.total_candidates },
                  { label: 'Interview', value: stats.interview_ready, of: stats.total_candidates },
                  { label: 'Rejected', value: stats.rejected, of: stats.total_candidates },
                ].map(({ label, value, of }) => (
                  <div key={label}>
                    <p className="text-base font-bold text-white">{value}</p>
                    <p className="text-[10px] text-zinc-600">{label}</p>
                    <p className="text-[10px] text-zinc-700">
                      {Math.round((value / of) * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Top 5 candidates */}
        <div className="lg:col-span-2">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.25 }}
          >
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
                <div className="space-y-2">
                  {topCandidates?.candidates.map((c, i) => (
                    <Link
                      key={c.candidate_id}
                      to={`/candidates/${c.candidate_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
                    >
                      <span className="w-6 text-right text-xs text-zinc-600 font-mono shrink-0">
                        #{c.rank}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                          {c.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
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

                      <div className="flex items-center gap-2 shrink-0">
                        {c.has_production_ml && (
                          <Badge variant="emerald">Prod ML</Badge>
                        )}
                        {c.is_hidden_gem && (
                          <Badge variant="amber">Gem</Badge>
                        )}
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

      {/* Quick links */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.35 }}
        className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          { to: '/jd-analysis', icon: TrendingUp, label: 'JD Analysis', sub: 'Validate & improve your JD', color: 'violet' },
          { to: '/hidden-talent', icon: Gem, label: 'Hidden Talent', sub: 'Overlooked strong candidates', color: 'amber' },
          { to: '/compare', icon: Award, label: 'Compare', sub: 'Side-by-side candidate view', color: 'blue' },
          { to: '/chat', icon: Users, label: 'AI Copilot', sub: 'Ask anything about candidates', color: 'emerald' },
        ].map(({ to, icon: Icon, label, sub, color }) => (
          <Link key={to} to={to}>
            <Card hover className="p-4 h-full">
              <CardContent className="p-0">
                <Icon className={`w-4 h-4 mb-2 text-${color}-400`} />
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>
    </div>
  )
}
