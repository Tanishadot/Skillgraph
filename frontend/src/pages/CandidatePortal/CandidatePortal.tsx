import { useState } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle2, AlertTriangle, ArrowRight, Zap, Loader2 } from 'lucide-react'
import { analyzeResume } from '@/api/chat'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { ScoreRing } from '@/components/common/ScoreRing'
import { scoreToHsl } from '@/lib/utils'
import type { ResumeAnalysisResponse } from '@/types'

export function CandidatePortal() {
  const [resumeText, setResumeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResumeAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/plain': ['.txt'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: async (files) => {
      const file = files[0]
      if (!file) return
      const text = await file.text()
      setResumeText(text)
    },
  })

  const analyze = async () => {
    if (!resumeText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await analyzeResume(resumeText)
      setResult(data)
    } catch (err) {
      setError('Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">AI Hiring Copilot</p>
          <p className="text-[10px] text-zinc-500">Candidate Self-Assessment Portal</p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white mb-2">How strong is your application?</h1>
          <p className="text-zinc-400 mb-8">
            Paste your resume or upload a .txt file to see how well you match the{' '}
            <strong className="text-violet-400">Senior AI Engineer</strong> role at Redrob AI.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                isDragActive
                  ? 'border-violet-500/60 bg-violet-500/5'
                  : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.01]'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Drop your resume (.txt / .pdf)</p>
              <p className="text-xs text-zinc-600 mt-1">or click to browse</p>
            </div>

            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Or paste your resume text here..."
              rows={14}
              className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 text-sm text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-violet-500/40 resize-none"
            />

            <Button
              onClick={analyze}
              loading={loading}
              className="w-full justify-center py-3"
              disabled={!resumeText.trim()}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Analyze My Resume
            </Button>

            {error && (
              <p className="text-sm text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          {/* Results */}
          {result ? (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {/* Match score */}
              <Card className="p-5 flex items-center gap-5">
                <ScoreRing score={result.match_score} size={80} strokeWidth={6} />
                <div>
                  <p className="text-base font-semibold text-white">
                    {result.match_score >= 0.75
                      ? 'Strong Match'
                      : result.match_score >= 0.5
                      ? 'Moderate Match'
                      : 'Weak Match'}
                  </p>
                  <p className="text-sm text-zinc-400">
                    You match {Math.round(result.match_score * 100)}% of the core requirements
                  </p>
                  <p className="text-xs text-emerald-400 mt-1">
                    With improvements: up to {Math.round(result.estimated_improvement * 100)}%
                  </p>
                </div>
              </Card>

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-medium text-white">Your Strengths</p>
                  </div>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Missing skills */}
              {result.missing_skills.length > 0 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-medium text-white">Skills to Develop</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing_skills.map((sk) => (
                      <Badge key={sk} variant="amber">{sk}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recommended projects */}
              <Card className="p-5">
                <p className="text-sm font-medium text-white mb-3">Recommended Projects</p>
                <ul className="space-y-2">
                  {result.recommended_projects.map((p, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                      <span className="text-violet-500 font-bold mt-0.5">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Certifications */}
              <Card className="p-5">
                <p className="text-sm font-medium text-white mb-3">Recommended Certifications</p>
                <ul className="space-y-1.5">
                  {result.recommended_certifications.map((cert, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      {cert}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
              <p className="text-zinc-400 text-sm">Your results will appear here</p>
              <p className="text-zinc-600 text-xs mt-1">Paste your resume and click analyze</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
