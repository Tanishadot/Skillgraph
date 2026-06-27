import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLMotionProps<'div'> {
  glass?: boolean
  hover?: boolean
}

export function Card({ glass, hover, className, children, ...props }: CardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-xl border',
        glass
          ? 'bg-white/[0.03] border-white/[0.06] backdrop-blur-md'
          : 'bg-zinc-900/60 border-white/[0.06]',
        hover && 'cursor-pointer transition-colors duration-200 hover:border-white/10 hover:bg-zinc-900/80',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function CardHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pb-0', className)}>{children}</div>
}

export function CardContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)}>{children}</div>
}

export function CardTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-semibold text-zinc-200', className)}>{children}</h3>
  )
}
