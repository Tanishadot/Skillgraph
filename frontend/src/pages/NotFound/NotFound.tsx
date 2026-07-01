import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Home, Search } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <p className="text-8xl font-bold text-zinc-800 select-none mb-2">404</p>
        <p className="text-xl font-semibold text-white mb-2">Page not found</p>
        <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] hover:border-white/[0.16] text-zinc-300 hover:text-white text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back Home
          </Link>
          <Link
            to="/rankings"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] hover:border-white/[0.16] text-zinc-300 hover:text-white text-sm font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            Search Candidates
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
