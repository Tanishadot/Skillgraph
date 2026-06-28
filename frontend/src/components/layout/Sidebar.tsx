import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FileText,
  Gem,
  BarChart3,
  MessageSquare,
  GitCompare,
  Settings,
  Zap,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: undefined,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'RECRUIT',
    items: [
      { to: '/rankings',    icon: Users,      label: 'Rankings'    },
      { to: '/compare',     icon: GitCompare, label: 'Compare'     },
      { to: '/jd-analysis', icon: FileText,   label: 'JD Analysis' },
    ],
  },
  {
    label: 'DISCOVER',
    items: [
      { to: '/hidden-talent', icon: Gem,           label: 'Hidden Talent' },
      { to: '/analytics',     icon: BarChart3,     label: 'Analytics'     },
      { to: '/chat',          icon: MessageSquare, label: 'AI Copilot'    },
    ],
  },
]

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
          isActive
            ? 'bg-violet-600/15 text-violet-300 font-medium border-l-2 border-violet-500 pl-[10px]'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border-l-2 border-transparent pl-[10px]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-violet-400' : '')} />
          {label}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-[220px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-black/20"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">SkillGraph</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">AI Hiring Copilot</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon, label }) => (
                <NavItem key={to} to={to} icon={icon} label={label} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-4 space-y-0.5">
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150 group"
        >
          <ExternalLink className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
          <span>Candidate Portal</span>
        </a>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border-l-2',
              isActive
                ? 'bg-violet-600/15 text-violet-300 font-medium border-violet-500 pl-[10px]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border-transparent pl-[10px]'
            )
          }
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </motion.aside>
  )
}
