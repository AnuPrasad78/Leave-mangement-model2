import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { ServicedError } from '../types/models'

export async function createSeparationRequest({ last_working_day, reason, remarks }: {
  // employee_id may be undefined when the profile never resolved — JSON.stringify
  // drops the key and the DB NOT NULL violation surfaces as the normalized error.
  employee_id: string | null | undefined
  last_working_day: string
  reason: string
  remarks: string | null
}): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'separation request',
    async () => {
      await apiRequest('/separation-requests', {
        method: 'POST',
        body: JSON.stringify({ last_working_day, reason, remarks }),
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}
