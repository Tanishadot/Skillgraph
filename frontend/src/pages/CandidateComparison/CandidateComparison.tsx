import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { GitCompare, Plus, X, Trophy, CheckCircle2 } from 'lucide-react'
import { compareCandidates, fetchCandidates } from '@/api/candidates'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing } from '@/components/common/ScoreRing'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatYears, formatDays, SCORE_LABELS } from '@/lib/utils'
import type { ComparisonResponse } from '@/types'

const RADAR_DIMS = ['experience', 'projects', 'semantic_match', 'domain_fit', 'behavior', 'career_growth']
const RADAR_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function CandidateComparison() {
  const [searchParams] = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [result, setResult] = useState<ComparisonResponse | null>(null)

  // Pre-fill from query string
  useEffect(() => {
    const ids = searchParams.get('ids')
    if (ids) setSelectedIds(ids.split(',').slice(0, 5))
  }, [])

  const { data: topCandidates } = useQuery({
    queryKey: ['candidates', { page: 1, limit: 20 }],
    queryFn: () => fetchCandidates({ page: 1, limit: 20 }),
  })

  const { mutate: compare, isPending } = useMutation({
    mutationFn: () => compareCandidates(selectedIds),
    onSuccess: setResult,
  })

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    )
    setResult(null)
  }

  const radarData = result
    ? RADAR_DIMS.map((dim) => {
        const point: Record<string, string | number> = { subject: SCORE_LABELS[dim] ?? dim }
        result.candidates.forEach((c) => {
          point[c.candidate_id.slice(-5)] = Math.round(((c.score_breakdown as any)[dim] ?? 0) * 100)
        })
        return point
      })
    : []

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <GitCompare className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-semibold text-white">Candidate Comparison</h1>
      </div>

      {/* Selector */}
      <Card className="p-5 mb-5">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
          Select up to 5 candidates
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono text-violet-300">{id}</span>
              <button onClick={() => toggleId(id)}>
                <X className="w-3 h-3 text-violet-400 hover:text-violet-200" />
              </button>
            </div>
          ))}
          {selectedIds.length === 0 && (
            <p className="text-xs text-zinc-600">No candidates selected</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {topCandidates?.candidates.map((c) => (
            <button
              key={c.candidate_id}
              onClick={() => toggleId(c.candidate_id)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                selectedIds.includes(c.candidate_id)
                  ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                  : 'border-white/[0.06] text-zinc-400 hover:border-violet-500/30 hover:text-zinc-200'
              }`}
            >
              #{c.rank} {c.title.split(' ').slice(-2).join(' ')} ({c.candidate_id.slice(-5)})
            </button>
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => compare()}
            disabled={selectedIds.length < 2}
            loading={isPending}
          >
            Compare {selectedIds.length} candidates
          </Button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Winner analysis */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Recommendation</span>
            </div>
            <p className="text-sm text-zinc-300">{result.analysis}</p>
          </div>

          {/* Side-by-side cards */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${result.candidates.length}, minmax(0, 1fr))` }}>
            {result.candidates.map((c, i) => {
              const isWinner = c.candidate_id === result.winner_id
              return (
                <Card
                  key={c.candidate_id}
                  className={`p-4 ${isWinner ? 'border-violet-500/30 bg-violet-500/5' : ''}`}
                >
                  {isWinner && (
                    <div className="flex items-center gap-1 mb-2">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400 font-medium">Top Ranked</span>
                    </div>
                  )}
                  <ScoreRing score={c.overall_score} size={56} strokeWidth={4} />
                  <p className="text-xs font-medium text-zinc-200 mt-2 leading-tight">{c.title}</p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{c.candidate_id}</p>
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>Rank</span><span className="text-zinc-300">#{c.rank}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>Experience</span><span className="text-zinc-300">{formatYears(c.experience_years)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>AI/ML</span><span className="text-zinc-300">{formatYears(c.ai_ml_years)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>Notice</span><span className="text-zinc-300">{formatDays(c.notice_period_days)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>Prod ML</span>
                      <span>{c.has_production_ml ? <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" /> : '—'}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-0.5">
                    {c.top_skills.slice(0, 3).map((sk) => (
                      <span key={sk} className="text-[9px] px-1 py-0.5 rounded bg-white/[0.04] text-zinc-600">{sk}</span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Radar */}
          {radarData.length > 0 && (
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Score Radar</p>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#52525b', fontSize: 11 }} />
                  {result.candidates.map((c, i) => (
                    <Radar
                      key={c.candidate_id}
                      name={c.candidate_id.slice(-6)}
                      dataKey={c.candidate_id.slice(-5)}
                      stroke={RADAR_COLORS[i]}
                      fill={RADAR_COLORS[i]}
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                    />
                  ))}
                  <Legend formatter={(val) => <span className="text-xs text-zinc-400">{val}</span>} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v}`, '']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Dimension winners */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Dimension Winners</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Object.entries(result.dimension_winners).map(([dim, winnerId]) => (
                <div key={dim} className="text-center">
                  <p className="text-[10px] text-zinc-600 mb-1">{SCORE_LABELS[dim] ?? dim}</p>
                  <Badge variant="violet">{winnerId.slice(-6)}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
