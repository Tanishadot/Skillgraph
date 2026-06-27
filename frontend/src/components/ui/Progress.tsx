import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  trackClassName?: string
  color?: string
  height?: number
}

export function Progress({ value, max = 1, className, trackClassName, color, height = 4 }: ProgressProps) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div
      className={cn('w-full rounded-full bg-white/[0.06]', className)}
      style={{ height }}
    >
      <div
        className={cn('rounded-full transition-all duration-500', trackClassName)}
        style={{ width: `${pct}%`, height, backgroundColor: color || undefined }}
      />
    </div>
  )
}
