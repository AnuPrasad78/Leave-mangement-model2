import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { LeavePolicyMeRow, ServicedError } from '../types/models'

export async function fetchMyLeavePolicy(): Promise<{ row: LeavePolicyMeRow | null; error: ServicedError | null }> {
  return withServiceErrors(
    'leave policy lookup',
    async () => {
      const row = await apiRequest<LeavePolicyMeRow>('/leave-policies/me')
      return { row: row ?? null, error: null }
    },
    (error) => ({ row: null, error }),
    true
  )
}
