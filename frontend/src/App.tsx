import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/layout/Layout'
import { Landing } from '@/pages/Landing/Landing'
import { Dashboard } from '@/pages/Dashboard/Dashboard'
import { CandidateRankings } from '@/pages/CandidateRankings/CandidateRankings'
import { CandidateDetail } from '@/pages/CandidateDetail/CandidateDetail'
import { CandidateComparison } from '@/pages/CandidateComparison/CandidateComparison'
import { JobAnalysis } from '@/pages/JobAnalysis/JobAnalysis'
import { HiddenTalent } from '@/pages/HiddenTalent/HiddenTalent'
import { Analytics } from '@/pages/Analytics/Analytics'
import { RecruiterChat } from '@/pages/RecruiterChat/RecruiterChat'
import { CandidatePortal } from '@/pages/CandidatePortal/CandidatePortal'
import { Settings } from '@/pages/Settings/Settings'

export default function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/portal" element={<CandidatePortal />} />

        {/* Recruiter dashboard */}
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rankings" element={<CandidateRankings />} />
          <Route path="candidates/:id" element={<CandidateDetail />} />
          <Route path="compare" element={<CandidateComparison />} />
          <Route path="jd-analysis" element={<JobAnalysis />} />
          <Route path="hidden-talent" element={<HiddenTalent />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="chat" element={<RecruiterChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}
