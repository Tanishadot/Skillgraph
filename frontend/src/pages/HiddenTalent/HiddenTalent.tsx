import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Gem, Cpu, MapPin, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { fetchHiddenGems } from '@/api/candidates'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { ScoreRing } from '@/components/common/ScoreRing'
import { formatYears, formatDays, scoreToHsl, truncate, SCORE_LABELS } from '@/lib/utils'

export function HiddenTalent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hidden-gems'],
    queryFn: fetchHiddenGems,
  })

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Gem className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl font-semibold text-white">Hidden Talent</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Strong candidates ranked lower due to low recruiter visibility — not low ability.
          These candidates have score ≥0.63, high career growth, and open-to-work or low response rate.
        </p>
      </div>

      {/* Criteria explanation */}
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 mb-5">
        <p className="text-xs text-amber-400 font-medium mb-2">Detection Criteria</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Score Threshold', val: '≥ 63.0', icon: CheckCircle2 },
            { label: 'Career Growth', val: '≥ 70%', icon: CheckCircle2 },
            { label: 'Visibility Signal', val: 'Low response OR open to work', icon: CheckCircle2 },
            { label: 'Rank Filter', val: 'Outside top 20', icon: CheckCircle2 },
          ].map(({ label, val, icon: Icon }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-zinc-400">{label}</p>
                <p className="text-xs text-amber-300 font-medium">{val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <ErrorState message={String(error)} />}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : data?.candidates.length === 0 ? (
        <div className="text-center py-16">
          <Gem className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">No hidden gems detected in the current pool</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600 mb-4">
            Found <strong className="text-amber-400">{data?.total}</strong> hidden gems
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data?.candidates.map((c, i) => {
              const sb = (c as any).score_breakdown ?? {}
              return (
                <motion.div
                  key={c.candidate_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link to={`/candidates/${c.candidate_id}`} className="block h-full">
                    <Card hover className="h-full p-5">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <ScoreRing score={c.overall_score} size={64} strokeWidth={5} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-zinc-200">{c.title}</span>
                            <Badge variant="amber"><Gem className="w-2.5 h-2.5 mr-1" />Hidden Gem</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{formatYears(c.ai_ml_years)} AI/ML</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location.split(',')[0]}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDays(c.notice_period_days)}</span>
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            {c.has_production_ml && <Badge variant="emerald">Prod ML</Badge>}
                            {c.open_to_work && <Badge variant="violet">Open to work</Badge>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-zinc-500">Rank</p>
                          <p className="text-lg font-bold text-zinc-300">#{c.rank}</p>
                        </div>
                      </div>

                      {/* Score bars */}
                      <div className="space-y-1.5">
                        {['career_growth', 'projects', 'semantic_match'].map((dim) => {
                          const val = sb[dim] ?? c.overall_score
                          return (
                            <div key={dim} className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-600 w-28 shrink-0">
                                {SCORE_LABELS[dim] ?? dim}
                              </span>
                              <Progress value={val} height={3} color={scoreToHsl(val)} className="flex-1" />
                              <span className="text-[10px] text-zinc-500 w-8 text-right">
                                {Math.round(val * 100)}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {c.top_skills.slice(0, 5).map((sk) => (
                          <span key={sk} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500">
                            {sk}
                          </span>
                        ))}
                      </div>

                      {/* Reasoning */}
                      <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed line-clamp-2">
                        {truncate(c.reasoning, 160)}
                      </p>

                      <div className="flex items-center gap-1 mt-3 text-xs text-violet-400 group-hover:text-violet-300">
                        View full profile <ArrowRight className="w-3 h-3" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
