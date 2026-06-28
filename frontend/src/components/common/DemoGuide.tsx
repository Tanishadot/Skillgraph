import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Map, X } from 'lucide-react'

const STEPS = [
  { path: '/',            label: 'Landing',       desc: 'Recruiter / Candidate split' },
  { path: '/jd-analysis', label: 'JD Validator',  desc: 'Detect impossible requirements' },
  { path: '/rankings',    label: 'Rankings',       desc: 'Filter & explore top 100' },
  { path: '/candidates',  label: 'Profile',        desc: 'Score breakdown + radar' },
  { path: '/hidden-talent',label: 'Hidden Gems',  desc: '7 overlooked high-fit candidates' },
  { path: '/analytics',   label: 'Analytics',      desc: 'Full-funnel pipeline insights' },
  { path: '/chat',        label: 'AI Copilot',     desc: 'Natural language queries' },
  { path: '/portal',      label: 'Candidate Portal', desc: 'Self-service resume analysis' },
]

export function DemoGuide() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const currentStep = STEPS.findIndex((s) =>
    pathname === s.path || pathname.startsWith(s.path + '/') || (s.path !== '/' && pathname.startsWith(s.path))
  )
  const active = currentStep >= 0 ? currentStep : 0

  const go = (idx: number) => {
    const step = STEPS[idx]
    if (!step) return
    if (step.path === '/portal') {
      window.open('/portal', '_blank')
    } else {
      navigate(step.path)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-[280px] rounded-xl border border-white/[0.10] bg-zinc-900/95 backdrop-blur shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Map className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-white">Demo Guide</span>
              </div>
              <button onClick={() => setOpen(false)}>
                <X className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
              </button>
            </div>
            <div className="p-2">
              {STEPS.map((step, i) => {
                const isCurrent = i === active
                const isPast = i < active
                return (
                  <button
                    key={step.path}
                    onClick={() => go(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                      isCurrent
                        ? 'bg-violet-500/15 border border-violet-500/20'
                        : 'hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors ${
                      isCurrent ? 'bg-violet-600 border-violet-600 text-white'
                      : isPast ? 'bg-zinc-700 border-zinc-700 text-zinc-400'
                      : 'border-zinc-700 text-zinc-600'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${isCurrent ? 'text-violet-300' : isPast ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-zinc-600 truncate">{step.desc}</p>
                    </div>
                    {isCurrent && <ChevronRight className="w-3 h-3 text-violet-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06]">
              <button
                onClick={() => go(active - 1)}
                disabled={active === 0}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-[10px] text-zinc-600">{active + 1} / {STEPS.length}</span>
              <button
                onClick={() => go(active + 1)}
                disabled={active === STEPS.length - 1}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle pill */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-medium shadow-lg shadow-violet-900/40 border border-violet-500/30 backdrop-blur transition-colors"
      >
        <Map className="w-3.5 h-3.5" />
        Demo Guide
        {active >= 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
            {active + 1}/{STEPS.length}
          </span>
        )}
      </motion.button>
    </div>
  )
}
