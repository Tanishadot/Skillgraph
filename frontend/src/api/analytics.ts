import { api } from './client'
import type { AnalyticsResponse, StatsResponse } from '@/types'

export const fetchStats = (): Promise<StatsResponse> => api.get('/stats')
export const fetchAnalytics = (): Promise<AnalyticsResponse> => api.get('/analytics')
