import { motion } from 'framer-motion'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  showPct?: boolean
}

export function ScoreRing({ score, size = 80, strokeWidth = 6, label, showPct = true }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const dash = circ * Math.min(score, 1)

  // Color based on score
  const color =
    score >= 0.75 ? '#34d399' : score >= 0.65 ? '#a78bfa' : score >= 0.55 ? '#fbbf24' : '#f87171'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPct && (
          <span className="text-sm font-bold" style={{ color }}>
            {Math.round(score * 100)}
          </span>
        )}
        {label && <span className="text-[10px] text-zinc-500 mt-0.5">{label}</span>}
      </div>
    </div>
  )
}
