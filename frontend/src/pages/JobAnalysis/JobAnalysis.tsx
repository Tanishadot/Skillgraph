import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileText, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Info } from 'lucide-react'
import { fetchJDProfile, validateJD } from '@/api/jd'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ScoreRing } from '@/components/common/ScoreRing'
import { statusColor, importanceColor } from '@/lib/utils'
import type { JDValidationResponse } from '@/types'

const JD_PLACEHOLDER = `Senior AI Engineer — Founding Team
Company: Redrob AI (Series A, Pune / Noida)

Required Skills & Experience
- 5+ years of experience in applied machine learning or AI engineering
- 3+ years of experience with NLP / information retrieval
- Production experience with vector databases: FAISS, Qdrant, Weaviate, Pinecone, or Milvus
- 2+ years of experience with LangChain
- Strong expertise in embedding models and semantic search
- Experience with RAG pipelines and retrieval architectures
- Proficiency in Python; experience with FastAPI or similar frameworks`

export function JobAnalysis() {
  const [jdText, setJdText] = useState(JD_PLACEHOLDER)
  const [result, setResult] = useState<JDValidationResponse | null>(null)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['jd-profile'],
    queryFn: fetchJDProfile,
  })

  const { mutate: runValidation, isPending } = useMutation({
    mutationFn: () => validateJD(jdText),
    onSuccess: (data) => setResult(data),
  })

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">JD Analysis & Validation</h1>
          <p className="text-sm text-zinc-500 mt-1">Detect impossible requirements, contradictions, and skill overload</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Editor + current profile */}
        <div className="space-y-4">
          {/* Current JD Profile */}
          {profileLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : profile ? (
            <Card className="p-5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Current Active JD</p>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-white">{profile.role}</p>
                  <p className="text-sm text-zinc-400">{profile.company}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {profile.experience_min_years}–{profile.experience_max_years} years experience
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Must-have skills</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(profile.must_have_skills).flatMap(([_, skills]) => skills).slice(0, 12).map((sk) => (
                    <Badge key={sk} variant="violet">{sk}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {/* JD Text editor */}
          <Card className="p-5">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Paste / Edit Job Description</p>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={16}
              className="w-full bg-black/30 border border-white/[0.06] rounded-lg p-4 text-sm text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-violet-500/40 resize-none"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => runValidation()} loading={isPending}>
                <RefreshCw className="w-3.5 h-3.5" />
                Analyze JD
              </Button>
            </div>
          </Card>
        </div>

        {/* Right — Results */}
        <div className="space-y-4">
          {!result && !isPending && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-10 flex flex-col items-center justify-center text-center">
              <FileText className="w-8 h-8 text-zinc-600 mb-3" />
              <p className="text-zinc-500 text-sm">Click "Analyze JD" to detect issues</p>
              <p className="text-zinc-600 text-xs mt-1">Checks for impossible requirements, contradictions, skill overload, and missing fields</p>
            </div>
          )}

          {isPending && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Quality score */}
              <Card className="p-5">
                <div className="flex items-center gap-4">
                  <ScoreRing score={result.jd_quality_score / 100} size={72} />
                  <div>
                    <p className="text-base font-semibold text-white">JD Quality Score: {result.jd_quality_score}/100</p>
                    <p className="text-sm text-zinc-400">
                      {result.experience_issues.length} experience issues ·{' '}
                      {result.contradictions.length} contradictions ·{' '}
                      {result.missing_requirements.length} missing fields
                    </p>
                    {result.improvements_applied.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.improvements_applied.map((imp) => (
                          <Badge key={imp} variant="emerald" size="sm">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />{imp}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Experience issues */}
              {result.experience_issues.length > 0 && (
                <Card className="p-5">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
                    Experience Requirements
                  </p>
                  <div className="space-y-2">
                    {result.experience_issues.map((issue, i) => (
                      <div key={i} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-zinc-200">{issue.technology}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColor(issue.status)}`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">{issue.reasoning}</p>
                        {issue.suggested_range && (
                          <p className="text-xs text-violet-400 mt-1">
                            <ArrowRight className="w-3 h-3 inline mr-1" />{issue.suggested_range}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Contradictions */}
              {result.contradictions.length > 0 && (
                <Card className="p-5">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Contradictions</p>
                  <div className="space-y-2">
                    {result.contradictions.map((c, i) => (
                      <div key={i} className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-sm font-medium text-zinc-200">{c.contradiction_type}</span>
                        </div>
                        <p className="text-xs text-zinc-500">{c.explanation}</p>
                        {c.suggestion && (
                          <p className="text-xs text-amber-400 mt-1">{c.suggestion}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Missing requirements */}
              {result.missing_requirements.length > 0 && (
                <Card className="p-5">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Missing Requirements</p>
                  <div className="space-y-1.5">
                    {result.missing_requirements.map((m, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-300">{m.field_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${importanceColor(m.importance)}`}>
                              {m.importance}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600">{m.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Transferable skills */}
              {result.transferable_mappings.length > 0 && (
                <Card className="p-5">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
                    Transferable Skills (Accept These Too)
                  </p>
                  <div className="space-y-2">
                    {result.transferable_mappings.slice(0, 6).map((m, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Badge variant="violet">{m.canonical_skill}</Badge>
                        <div className="flex items-center gap-1 flex-wrap text-xs text-zinc-500">
                          <ArrowRight className="w-3 h-3 shrink-0" />
                          {m.equivalents.slice(0, 4).map((eq) => (
                            <Badge key={eq} variant="zinc">{eq}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
