import { api } from './client'
import type { JDValidationResponse, ResumeAnalysisResponse } from '@/types'

export interface PortalJob {
  id: string
  title: string
  company: string
  location: string
  type: string
  experience_range: string
  summary: string
  jd_text: string
  must_have_skills: Record<string, string[]>
  nice_to_have_skills: string[]
  top_skills: string[]
}

export interface PortalJobsResponse {
  jobs: PortalJob[]
}

export const fetchPortalJobs = (): Promise<PortalJobsResponse> =>
  api.get('/portal/jobs')

export function analyzeResume(
  resumeText: string,
  jobId: string,
  customJd?: string
): Promise<ResumeAnalysisResponse> {
  const form = new FormData()
  form.append('resume_text', resumeText)
  form.append('job_id', jobId)
  if (customJd) form.append('custom_jd', customJd)
  return api.postForm('/portal/analyze', form)
}

export function validateCustomJD(text: string): Promise<JDValidationResponse> {
  const form = new FormData()
  form.append('text', text)
  return api.postForm('/jd/validate', form)
}
