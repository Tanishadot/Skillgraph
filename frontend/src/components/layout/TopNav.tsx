import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, Cpu } from 'lucide-react'
import { fetchStats } from '@/api/analytics'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/rankings': 'Candidate Rankings',
  '/compare': 'Candidate Comparison',
  '/jd-analysis': 'JD Analysis',
  '/hidden-talent': 'Hidden Talent',
  '/analytics': 'Analytics',
  '/chat': 'AI Copilot',
  '/settings': 'Settings',
}

export function TopNav() {
  const { pathname } = useLocation()
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  })

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ??
    'AI Hiring Copilot'

  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 bg-black/10 shrink-0">
      <h1 className="text-sm font-medium text-zinc-200">{title}</h1>
      <div className="flex items-center gap-4">
        {stats && (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-zinc-400">{stats.total_candidates.toLocaleString()} candidates</span>
            </span>
            <span className="w-px h-3 bg-zinc-700" />
            <span className="flex items-center gap-1">
              {stats.pipeline_ready ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{stats.pipeline_ready ? 'Pipeline ready' : 'Loading...'}</span>
            </span>
            <span className="w-px h-3 bg-zinc-700" />
            <span>Avg score: <strong className="text-zinc-300">{stats.avg_score.toFixed(3)}</strong></span>
          </div>
        )}
      </div>
    </header>
  )
}
