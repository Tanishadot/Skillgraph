import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const VARIANTS: Record<string, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/30',
  secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-white/[0.06]',
  ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]',
  destructive: 'bg-rose-600/15 text-rose-400 border border-rose-500/20 hover:bg-rose-600/25',
  outline: 'border border-white/[0.08] text-zinc-300 hover:border-white/[0.14] hover:bg-white/[0.03]',
}

const SIZES: Record<string, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2 rounded-lg gap-2',
  lg: 'text-sm px-5 py-2.5 rounded-xl gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
