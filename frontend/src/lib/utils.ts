import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatScore(score: number): string {
  return (score * 100).toFixed(1) + '%'
}

export function formatScoreRaw(score: number): string {
  return score.toFixed(3)
}

export function scoreColor(score: number): string {
  if (score >= 0.75) return 'text-emerald-400'
  if (score >= 0.65) return 'text-violet-400'
  if (score >= 0.55) return 'text-amber-400'
  return 'text-rose-400'
}

export function scoreBg(score: number): string {
  if (score >= 0.75) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  if (score >= 0.65) return 'bg-violet-500/10 border-violet-500/20 text-violet-400'
  if (score >= 0.55) return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  return 'bg-rose-500/10 border-rose-500/20 text-rose-400'
}

export function formatYears(years: number): string {
  if (years < 1) return `${Math.round(years * 12)}mo`
  return `${years.toFixed(1)}yr`
}

export function formatDays(days: number): string {
  if (days === 0) return 'Immediate'
  if (days <= 7) return `${days}d`
  if (days <= 30) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

export function proficiencyColor(p: string): string {
  const map: Record<string, string> = {
    expert: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    advanced: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    intermediate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    beginner: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  }
  return map[p] ?? map.beginner
}

export function tierLabel(tier: number): string {
  return tier === 1 ? 'Core' : tier === 2 ? 'Preferred' : 'Adjacent'
}

export function importanceColor(importance: string): string {
  const map: Record<string, string> = {
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    recommended: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    optional: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  }
  return map[importance] ?? map.optional
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Impossible: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    Implausible: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    Rare: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Valid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  }
  return map[status] ?? map.Valid
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

export function relativeTime(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'Unknown'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}yr ago`
}

export function scoreToHsl(score: number): string {
  // green (120°) → yellow (60°) → red (0°)
  const hue = Math.round(score * 120)
  return `hsl(${hue}, 65%, 55%)`
}

export const SCORE_LABELS: Record<string, string> = {
  experience: 'Experience',
  projects: 'Projects',
  semantic_match: 'Semantic Match',
  domain_fit: 'Domain Fit',
  behavior: 'Behavior',
  career_growth: 'Career Growth',
  education: 'Education',
  certifications: 'Certifications',
}

export const SCORE_WEIGHTS: Record<string, number> = {
  experience: 0.22,
  projects: 0.28,
  semantic_match: 0.20,
  domain_fit: 0.12,
  behavior: 0.08,
  career_growth: 0.05,
  education: 0.03,
  certifications: 0.02,
}
