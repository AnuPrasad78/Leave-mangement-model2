import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function createSeparationRequest({ employee_id, last_working_day, reason, remarks }) {
  const { error } = await supabase.from('separation_requests').insert({
    employee_id,
    last_working_day,
    reason,
    remarks,
  })
  return { error: normalizeSupabaseError(error, 'separation request') }
}
