import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Upload, CheckCircle2, AlertTriangle, ArrowRight, Zap, Loader2,
  Briefcase, MapPin, Clock, ChevronRight, RotateCcw,
} from 'lucide-react'
import { fetchPortalJobs, analyzeResume } from '@/api/portal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing } from '@/components/common/ScoreRing'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ResumeAnalysisResponse } from '@/types'
import type { PortalJob } from '@/api/portal'

type Step = 'select-job' | 'upload-resume' | 'results'

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { key: 'select-job', label: 'Choose Role' },
    { key: 'upload-resume', label: 'Your Resume' },
    { key: 'results', label: 'Analysis' },
  ]
  const current = steps.findIndex((s) => s.key === step)
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-violet-400' : 'text-zinc-600'}`}>
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors ${
              i < current ? 'bg-violet-600 border-violet-600 text-white'
              : i === current ? 'border-violet-500 text-violet-400'
              : 'border-zinc-700 text-zinc-600'
            }`}>
              {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:block">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className={`w-3.5 h-3.5 mx-2 ${i < current ? 'text-violet-500' : 'text-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function JobCard({ job, selected, onClick }: { job: PortalJob; selected: boolean; onClick: () => void }) {
  const skills = job.top_skills?.length ? job.top_skills : Object.values(job.must_have_skills ?? {}).flat().slice(0, 6)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-5 transition-all duration-150 ${
        selected
          ? 'border-violet-500/50 bg-violet-500/8 ring-1 ring-violet-500/30'
          : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{job.title}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{job.company}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
        {job.location && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
        )}
        {job.type && (
          <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.type}</span>
        )}
        {job.experience_range && (
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.experience_range}</span>
        )}
      </div>
      {job.summary && (
        <p className="text-xs text-zinc-500 mt-3 leading-relaxed line-clamp-2">{job.summary}</p>
      )}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {(skills as string[]).slice(0, 6).map((sk) => (
            <span key={sk} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-500">{sk}</span>
          ))}
        </div>
      )}
    </button>
  )
}

export function CandidatePortal() {
  const [step, setStep] = useState<Step>('select-job')
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [result, setResult] = useState<ResumeAnalysisResponse | null>(null)

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['portal-jobs'],
    queryFn: fetchPortalJobs,
  })

  const { mutate: analyze, isPending: analyzing, error: analyzeError } = useMutation({
    mutationFn: () => analyzeResume(resumeText, selectedJob!.id),
    onSuccess: (data) => {
      setResult(data)
      setStep('results')
    },
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/plain': ['.txt'] },
    maxFiles: 1,
    onDrop: (files) => {
      const file = files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => setResumeText(e.target?.result as string ?? '')
      reader.readAsText(file)
    },
  })

  const reset = () => {
    setStep('select-job')
    setSelectedJob(null)
    setResumeText('')
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">SkillGraph</p>
            <p className="text-[10px] text-zinc-500">Candidate Self-Assessment</p>
          </div>
        </div>
        {step !== 'select-job' && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Start over
          </button>
        )}
      </div>

      <div className="max-w-[800px] mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white mb-1">How strong is your application?</h1>
          <p className="text-sm text-zinc-500 mb-8">
            Select a role, paste your resume, and get an instant AI-powered match analysis.
          </p>
          <StepIndicator step={step} />
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Step 1: Job selection */}
          {step === 'select-job' && (
            <motion.div
              key="select-job"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-zinc-300 mb-4">Available positions:</p>
              {jobsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              ) : jobsData?.jobs.length ? (
                <div className="space-y-3">
                  {jobsData.jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      selected={selectedJob?.id === job.id}
                      onClick={() => setSelectedJob(job)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-600">
                  <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No positions available. Make sure the backend is running.</p>
                </div>
              )}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setStep('upload-resume')}
                  disabled={!selectedJob}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Resume upload */}
          {step === 'upload-resume' && (
            <motion.div
              key="upload-resume"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {selectedJob && (
                <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 px-4 py-3 flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-violet-300">{selectedJob.title}</p>
                    <p className="text-xs text-zinc-500">{selectedJob.company}</p>
                  </div>
                </div>
              )}

              <div
                {...getRootProps()}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  isDragActive
                    ? 'border-violet-500/60 bg-violet-500/5'
                    : 'border-white/[0.08] hover:border-violet-500/30 bg-white/[0.01]'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-7 h-7 text-zinc-500 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Drop your resume (.txt)</p>
                <p className="text-xs text-zinc-600 mt-1">or click to browse</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-[#09090b] text-xs text-zinc-600">or paste directly</span>
                </div>
              </div>

              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..."
                rows={16}
                className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 text-sm text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-violet-500/40 resize-none transition-colors"
              />

              {analyzeError && (
                <p className="text-sm text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {(analyzeError as Error).message}
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('select-job')}>
                  Back
                </Button>
                <Button
                  onClick={() => analyze()}
                  loading={analyzing}
                  disabled={!resumeText.trim() || analyzing}
                >
                  {analyzing ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Analyzing...</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-1.5" />Analyze Resume</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Match score hero */}
              <Card className="p-6 flex items-center gap-6">
                <ScoreRing score={result.match_score} size={96} strokeWidth={7} />
                <div>
                  <p className="text-xl font-bold text-white">
                    {result.match_score >= 0.75
                      ? 'Strong Match'
                      : result.match_score >= 0.5
                      ? 'Moderate Match'
                      : 'Needs Work'}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    You match <span className="text-white font-semibold">{Math.round(result.match_score * 100)}%</span> of core requirements
                    {selectedJob && ` for ${selectedJob.title}`}
                  </p>
                  <p className="text-xs text-emerald-400 mt-2">
                    With targeted improvements: up to {Math.round(result.estimated_improvement * 100)}% match
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                {result.strengths.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <p className="text-sm font-medium text-white">Your Strengths</p>
                    </div>
                    <ul className="space-y-2">
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
                    {result.transferable_skills.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <p className="text-[10px] text-zinc-600 mb-2 uppercase tracking-wider">Transferable skills you have</p>
                        <div className="flex flex-wrap gap-1">
                          {result.transferable_skills.map((sk) => (
                            <Badge key={sk} variant="violet">{sk}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Recommended projects */}
              <Card className="p-5">
                <p className="text-sm font-medium text-white mb-3">Recommended Projects to Build</p>
                <ul className="space-y-2.5">
                  {result.recommended_projects.map((p, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-start gap-2.5">
                      <span className="text-violet-500 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Career suggestions */}
              {result.career_suggestions.length > 0 && (
                <Card className="p-5">
                  <p className="text-sm font-medium text-white mb-3">Career Development Suggestions</p>
                  <ul className="space-y-2">
                    {result.career_suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Certifications */}
              <Card className="p-5">
                <p className="text-sm font-medium text-white mb-3">Recommended Certifications</p>
                <ul className="space-y-2">
                  {result.recommended_certifications.map((cert, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {cert}
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="pt-2 flex justify-center">
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Analyze another resume
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
