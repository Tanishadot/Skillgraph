import { api } from './client'
import type {
  CandidateDetail,
  CandidateFilters,
  ComparisonResponse,
  PaginatedCandidates,
} from '@/types'

export function fetchCandidates(filters: CandidateFilters = {}): Promise<PaginatedCandidates> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.search) params.set('search', filters.search)
  if (filters.min_score != null) params.set('min_score', String(filters.min_score))
  if (filters.has_production_ml != null) params.set('has_production_ml', String(filters.has_production_ml))
  if (filters.open_to_work != null) params.set('open_to_work', String(filters.open_to_work))
  if (filters.hidden_gems_only) params.set('hidden_gems_only', 'true')
  const qs = params.toString()
  return api.get(`/candidates${qs ? `?${qs}` : ''}`)
}

export function fetchCandidate(id: string): Promise<CandidateDetail> {
  return api.get(`/candidates/${id}`)
}

export function fetchHiddenGems(): Promise<{ candidates: CandidateDetail[]; total: number }> {
  return api.get('/candidates/hidden-gems')
}

export function compareCandidates(ids: string[]): Promise<ComparisonResponse> {
  return api.post('/candidates/compare', ids)
}
