import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Search, ChevronLeft, ChevronRight, MapPin, Clock,
  Cpu, ArrowUpDown, Gem, CheckCircle2, GitCompare, Filter,
} from 'lucide-react'
import { fetchCandidates } from '@/api/candidates'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { ScoreRing } from '@/components/common/ScoreRing'
import { formatYears, formatDays, scoreToHsl, truncate } from '@/lib/utils'
import type { CandidateFilters } from '@/types'

const SORT_OPTIONS = [
  { value: 'rank',       label: 'Rank'       },
  { value: 'score',      label: 'Score'      },
  { value: 'experience', label: 'Experience' },
  { value: 'ai_years',   label: 'AI Years'   },
]

const MIN_SCORE_OPTIONS = [
  { label: 'Any score', value: 0 },
  { label: '70+',       value: 0.7 },
  { label: '80+',       value: 0.8 },
  { label: '90+',       value: 0.9 },
]

const SCORE_DIMS = ['projects', 'semantic_match', 'experience', 'domain_fit'] as const

// ─── Avatar Initials ────────────────────────────────────────────────────────────

function Initials({ title }: { title: string }) {
  const words = title.trim().split(/\s+/)
  const a = words[0]?.[0] ?? ''
  const b = words[words.length > 1 ? words.length - 1 : 0]?.[0] ?? ''
  return (
    <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-violet-300 uppercase">{a}{b}</span>
    </div>
  )
}

// ─── Recommendation badge ───────────────────────────────────────────────────────

function RecBadge({ rec }: { rec: string }) {
  const r = rec.toLowerCase()
  if (r.includes('strong')) return <Badge variant="emerald">{rec}</Badge>
  if (r.includes('good'))   return <Badge variant="violet">{rec}</Badge>
  return null
}

// ─── CandidateRankings ─────────────────────────────────────────────────────────

export function CandidateRankings() {
  const [filters, setFilters] = useState<CandidateFilters>({
    page: 1,
    limit: 20,
    sort: 'rank',
    order: 'asc',
  })
  const [search, setSearch] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [minScore, setMinScore] = useState<number>(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidates', filters, search, minScore],
    queryFn: () => fetchCandidates({
      ...filters,
      search: search || undefined,
      min_score: minScore > 0 ? minScore : undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    )
  }, [])

  const setFilter = <K extends keyof CandidateFilters>(key: K, val: CandidateFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val, page: key !== 'page' ? 1 : (val as number) }))
  }

  if (error) return <div className="p-6"><ErrorState message={String(error)} /></div>

  // Build filter summary string
  const filterParts: string[] = []
  if (filters.has_production_ml) filterParts.push('Prod ML')
  if (filters.open_to_work)      filterParts.push('Open to work')
  if (filters.hidden_gems_only)  filterParts.push('Hidden gems')
  if (minScore > 0)              filterParts.push(`Score ≥ ${Math.round(minScore * 100)}`)
  if (search)                    filterParts.push(`"${search}"`)

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-white">Candidate Rankings</h1>
          {data ? (
            <p className="text-xs text-zinc-500 mt-0.5">
              {data.total.toLocaleString()} candidates
              {filterParts.length > 0 && (
                <> · filtered by: <span className="text-zinc-400">{filterParts.join(', ')}</span></>
              )}
              {' '}· page {data.page} of {data.total_pages}
            </p>
          ) : (
            <p className="text-xs text-zinc-600 mt-0.5">Loading pipeline…</p>
          )}
        </div>
        {compareIds.length > 0 && (
          <Link to={`/compare?ids=${compareIds.join(',')}`}>
            <Button size="sm" variant="outline">
              <GitCompare className="w-3.5 h-3.5" />
              Compare ({compareIds.length})
            </Button>
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by title, skill, location, ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })) }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.03] border border-white/[0.08] rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter('has_production_ml', filters.has_production_ml ? undefined : true)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              filters.has_production_ml
                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                : 'border-white/[0.08] text-zinc-400 hover:border-white/[0.14]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 inline mr-1.5" />
            Prod ML
          </button>
          <button
            onClick={() => setFilter('open_to_work', filters.open_to_work ? undefined : true)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              filters.open_to_work
                ? 'bg-violet-500/15 border-violet-500/25 text-violet-300'
                : 'border-white/[0.08] text-zinc-400 hover:border-white/[0.14]'
            }`}
          >
            Open to work
          </button>
          <button
            onClick={() => setFilter('hidden_gems_only', !filters.hidden_gems_only)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              filters.hidden_gems_only
                ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                : 'border-white/[0.08] text-zinc-400 hover:border-white/[0.14]'
            }`}
          >
            <Gem className="w-3 h-3 inline mr-1.5" />
            Gems only
          </button>
        </div>

        {/* Min score */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(Number(e.target.value))
              setFilters((f) => ({ ...f, page: 1 }))
            }}
            className="text-xs bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-violet-500/50"
          >
            {MIN_SCORE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value as CandidateFilters['sort'])}
            className="text-xs bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-violet-500/50"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {data?.candidates.map((c, i) => (
              <motion.div
                key={c.candidate_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/candidates/${c.candidate_id}`}
                  className="block rounded-xl border border-white/[0.06] bg-zinc-900/60 hover:border-violet-500/20 hover:bg-zinc-900/80 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* Compare checkbox */}
                    <button
                      onClick={(e) => { e.preventDefault(); toggleCompare(c.candidate_id) }}
                      className={`w-4 h-4 rounded border transition-colors shrink-0 ${
                        compareIds.includes(c.candidate_id)
                          ? 'bg-violet-600 border-violet-600'
                          : 'border-zinc-600 hover:border-violet-500'
                      }`}
                    />

                    {/* Avatar + Rank */}
                    <Initials title={c.title} />
                    <span className="w-8 text-right text-xs font-mono text-zinc-500 shrink-0">
                      #{c.rank}
                    </span>

                    {/* Score ring */}
                    <ScoreRing score={c.overall_score} size={52} strokeWidth={4} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                          {c.title}
                        </span>
                        {c.has_production_ml && <Badge variant="emerald">Prod ML</Badge>}
                        {c.is_hidden_gem && <Badge variant="amber">Gem</Badge>}
                        {c.open_to_work && <Badge variant="violet">Open</Badge>}
                        <RecBadge rec={c.recommendation} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <Cpu className="w-3 h-3" />
                          {formatYears(c.ai_ml_years)} AI/ML
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          {c.location}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {formatDays(c.notice_period_days)} notice
                        </span>
                      </div>

                      {/* Score chips */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {SCORE_DIMS.map((dim) => {
                          const cAny = c as unknown as Record<string, Record<string, number>>
                          const val: number = typeof cAny.score_breakdown === 'object' &&
                            cAny.score_breakdown !== null &&
                            typeof cAny.score_breakdown[dim] === 'number'
                            ? cAny.score_breakdown[dim]
                            : c.overall_score * 0.9
                          const labels: Record<string, string> = {
                            projects: 'Proj', semantic_match: 'Sem', experience: 'Exp', domain_fit: 'Dom',
                          }
                          return (
                            <div key={dim} className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] rounded-md px-1.5 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: scoreToHsl(val) }} />
                              <span className="text-[9px] text-zinc-600">{labels[dim]}</span>
                              <span className="text-[9px] font-mono text-zinc-400">{Math.round(val * 100)}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.top_skills.slice(0, 5).map((sk) => (
                          <span key={sk} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Score value */}
                    <span className="shrink-0 text-xs font-bold text-zinc-400 group-hover:text-violet-300 transition-colors tabular-nums">
                      {(c.overall_score * 100).toFixed(1)}
                    </span>
                  </div>

                  {/* Reasoning preview */}
                  <div className="px-[4.5rem] pb-3">
                    <p className="text-[11px] text-zinc-600 leading-relaxed group-hover:text-zinc-500 transition-colors">
                      {truncate(c.reasoning, 180)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            size="sm"
            variant="ghost"
            disabled={filters.page === 1}
            onClick={() => setFilter('page', (filters.page ?? 1) - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-zinc-400">
            {filters.page} / {data.total_pages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={filters.page === data.total_pages}
            onClick={() => setFilter('page', (filters.page ?? 1) + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
