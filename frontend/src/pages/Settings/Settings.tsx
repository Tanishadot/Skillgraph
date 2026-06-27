import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '@/api/analytics'
import { fetchJDProfile } from '@/api/jd'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SCORE_WEIGHTS, SCORE_LABELS } from '@/lib/utils'
import { Progress } from '@/components/ui/Progress'
import { ScoreRing } from '@/components/common/ScoreRing'

export function Settings() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const { data: profile } = useQuery({ queryKey: ['jd-profile'], queryFn: fetchJDProfile })

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Settings & Configuration</h1>
        <p className="text-sm text-zinc-500 mt-1">Pipeline configuration, scoring weights, and JD profile</p>
      </div>

      <div className="space-y-5">
        {/* Pipeline status */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Pipeline Status</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <ScoreRing score={stats.avg_score} size={64} />
                  <p className="text-xs text-zinc-500 mt-1">Avg Score</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={stats.avg_recruiter_response_rate} size={64} />
                  <p className="text-xs text-zinc-500 mt-1">Avg Response Rate</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={stats.qualified_candidates / stats.total_candidates} size={64} />
                  <p className="text-xs text-zinc-500 mt-1">Qualified %</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={stats.interview_ready / stats.total_candidates} size={64} />
                  <p className="text-xs text-zinc-500 mt-1">Interview Ready %</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Total Screened', val: stats.total_candidates.toLocaleString() },
                  { label: 'Honeypots', val: stats.honeypots_detected },
                  { label: 'Hidden Gems', val: stats.hidden_gems },
                  { label: 'Rejected', val: stats.rejected.toLocaleString() },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-base font-bold text-white">{val}</p>
                    <p className="text-xs text-zinc-600">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Scoring weights */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Scoring Weights (Read-only)</p>
            <div className="space-y-2.5">
              {Object.entries(SCORE_WEIGHTS).map(([key, weight]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-36 shrink-0">{SCORE_LABELS[key]}</span>
                  <Progress value={weight} className="flex-1" height={6} trackClassName="bg-violet-500/60" />
                  <span className="text-xs text-zinc-400 w-8 text-right font-mono">
                    {Math.round(weight * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-1">
              <p className="text-xs text-zinc-500 font-medium">Penalties (multiplicative)</p>
              {[
                { label: 'Consulting-only', val: '×0.40' },
                { label: 'Honeypot detected', val: '×0.04' },
                { label: 'Keyword stuffer', val: '×0.55' },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-zinc-500">{label}</span>
                  <Badge variant="rose">{val}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* JD Profile */}
        {profile && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Active JD Profile</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{profile.role}</p>
                  <p className="text-sm text-zinc-400">{profile.company}</p>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{profile.role_summary}</p>
                  <div className="mt-3 space-y-1 text-xs text-zinc-500">
                    <div className="flex justify-between">
                      <span>Experience Range</span>
                      <span className="text-zinc-300">{profile.experience_min_years}–{profile.experience_max_years} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Notice Period Ideal</span>
                      <span className="text-zinc-300">{profile.notice_period_ideal_days} days</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Preferred Locations</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {profile.preferred_locations.map((loc) => (
                      <Badge key={loc} variant="zinc">{loc}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Disqualifiers</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {profile.disqualifiers.map((d) => (
                      <Badge key={d} variant="rose">{d}</Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Nice-to-have Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.nice_to_have_skills.slice(0, 8).map((sk) => (
                      <Badge key={sk} variant="zinc">{sk}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Backend info */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Backend Info</p>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'API Base', val: 'http://localhost:8080/api' },
                { label: 'Embedding Backend', val: 'SBERT (all-MiniLM-L6-v2, 384-dim)' },
                { label: 'Ranking Layers', val: '7 (JD Validation, BM25, Semantic, Experience, Projects, Behavior, Career Growth)' },
                { label: 'Candidate Pool', val: '100,000 applicants → top 100 ranked' },
                { label: 'Docs', val: '/api/docs (Swagger)' },
              ].map(({ label, val }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-zinc-600 w-40 shrink-0">{label}</span>
                  <span className="text-zinc-400 font-mono text-[11px]">{val}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
