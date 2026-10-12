import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { SeparationRequestsInsert, ServicedError } from '../types/models'

export async function createSeparationRequest({ employee_id, last_working_day, reason, remarks }: {
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
      const payload = { employee_id, last_working_day, reason, remarks } as SeparationRequestsInsert
      const { error } = await supabase.from('separation_requests').insert(payload)
      return { error: normalizeSupabaseError(error, 'separation request') }
    },
    (error) => ({ error }),
    false,
    true
  )
}
