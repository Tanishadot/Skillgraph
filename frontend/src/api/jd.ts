import { api } from './client'
import type { JDProfileResponse, JDValidationResponse } from '@/types'

export const fetchJDProfile = (): Promise<JDProfileResponse> => api.get('/jd/profile')

export function validateJD(text: string): Promise<JDValidationResponse> {
  const form = new FormData()
  form.append('text', text)
  return api.postForm('/jd/validate', form)
}
