import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { fetchAnalytics, fetchStats } from '@/api/analytics'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'
import { ScoreRing } from '@/components/common/ScoreRing'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#18181b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.5rem',
    fontSize: 12,
    color: '#e4e4e7',
  },
}

const PALETTE = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316']

export function Analytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
  })
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  })

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Pipeline Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">Full-funnel insights across 100,000 candidates</p>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Screened', val: stats.total_candidates, sub: '' },
            { label: 'Qualified', val: stats.qualified_candidates, sub: `${Math.round(stats.qualified_candidates / stats.total_candidates * 100)}%` },
            { label: 'Interview Ready', val: stats.interview_ready, sub: '≥70 score' },
            { label: 'Hidden Gems', val: stats.hidden_gems, sub: '' },
            { label: 'Honeypots', val: stats.honeypots_detected, sub: 'flagged' },
          ].map(({ label, val, sub }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">
                  <AnimatedCounter to={val} />
                </p>
                <p className="text-xs text-zinc-500 mt-1">{label}</p>
                {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Score distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Score Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.score_distribution} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Candidates" radius={[4, 4, 0, 0]}>
                  {analytics.score_distribution.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Recruitment funnel */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Recruitment Funnel</p>
            <div className="space-y-2.5">
              {analytics.funnel.map((stage) => (
                <div key={stage.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">{stage.stage}</span>
                    <span className="text-zinc-300 font-medium">
                      {stage.count.toLocaleString()} · {stage.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-5 rounded-md overflow-hidden bg-white/[0.04]">
                    <motion.div
                      className="h-full rounded-md"
                      style={{ backgroundColor: stage.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${stage.percentage}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Experience distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Experience Distribution (Top 100)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.experience_distribution} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Candidates" fill="#8b5cf6" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Skill distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Top Skills in Pool</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={analytics.skill_distribution.slice(0, 10)}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 80 }}
              >
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} width={80} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Candidates" fill="#06b6d4" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Domain distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Domain Distribution</p>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={analytics.domain_distribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                  >
                    {analytics.domain_distribution.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {analytics.domain_distribution.slice(0, 8).map((d, i) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-[11px] text-zinc-400 flex-1 truncate">{d.label}</span>
                    <span className="text-[11px] text-zinc-500">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Location distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Location Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={analytics.location_distribution.slice(0, 8)}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 90 }}
              >
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} width={90} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Candidates" fill="#10b981" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Behavior distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Behavioral Signals</p>
            <div className="space-y-3">
              {analytics.behavior_distribution.map((b, i) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-36 shrink-0">{b.label}</span>
                  <div className="flex-1 h-4 bg-white/[0.04] rounded-md overflow-hidden">
                    <motion.div
                      className="h-full rounded-md"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length], opacity: 0.75 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, b.value)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-8 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Notice period distribution */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Notice Period Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.notice_period_distribution} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Candidates" fill="#f59e0b" fillOpacity={0.75} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}
