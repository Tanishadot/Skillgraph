import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'zinc'
  size?: 'sm' | 'md'
}

const VARIANTS: Record<string, string> = {
  default: 'bg-white/[0.06] text-zinc-300 border-white/10',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  zinc: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

export function Badge({ variant = 'default', size = 'sm', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border font-medium rounded-full',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
