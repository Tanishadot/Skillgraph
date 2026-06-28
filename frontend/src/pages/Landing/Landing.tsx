import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Users, Briefcase, ArrowRight, ChevronRight, Brain, Target, TrendingUp } from 'lucide-react'
import { DemoGuide } from '@/components/common/DemoGuide'

const FEATURES = [
  { icon: Brain, label: '7-layer AI ranking', desc: 'Semantic, behavioral, domain & growth signals' },
  { icon: Target, label: 'Honeypot detection', desc: 'Filters keyword stuffers and consulting farms' },
  { icon: TrendingUp, label: 'Hidden gem discovery', desc: 'Surfaces high-fit, low-visibility candidates' },
]

export function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">SkillGraph</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a href="/portal" target="_blank" rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200 transition-colors">
            Candidate Portal
          </a>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
          >
            Recruiter Login
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Redrob AI Hackathon Challenge
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-4xl mx-auto">
            Intelligent Candidate
            <br />
            <span className="text-violet-400">Discovery & Ranking</span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            A 7-layer hybrid AI pipeline that ranks 100,000 candidates with semantic matching,
            behavioral signals, and career growth analysis — surface the best fits in seconds.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Icon className="w-4 h-4 text-violet-400 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-medium text-zinc-200">{label}</p>
                  <p className="text-[10px] text-zinc-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA split */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
            >
              <Users className="w-5 h-5" />
              I'm a Recruiter
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.button>

            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="/portal"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl border border-white/[0.12] hover:border-violet-500/40 hover:bg-white/[0.03] text-zinc-200 font-semibold transition-all"
            >
              <Briefcase className="w-5 h-5" />
              I'm a Candidate
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.a>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-20 flex flex-wrap justify-center gap-8 text-center"
        >
          {[
            { value: '100K+', label: 'Candidates processed' },
            { value: '7', label: 'Ranking dimensions' },
            { value: '8', label: 'Score signals' },
            { value: '<50ms', label: 'Avg query time' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="border-t border-white/[0.06] px-8 py-5 text-center text-xs text-zinc-700">
        SkillGraph AI · Built for Redrob AI Hackathon 2025
      </footer>
      <DemoGuide />
    </div>
  )
}
