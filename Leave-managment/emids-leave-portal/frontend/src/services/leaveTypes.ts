import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { ServicedError } from '../types/models'

export async function fetchActiveLeaveTypeNames(): Promise<{ names: string[]; error: ServicedError | null }> {
  return withServiceErrors(
    'leave types lookup',
    async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('name')
        .eq('is_active', true)
        .order('id')
      return { names: (data ?? []).map((r) => r.name), error: normalizeSupabaseError(error, 'leave types lookup') }
    },
    (error) => ({ names: [], error }),
    true
  )
}

export async function fetchLeaveTypeIdByName(name: string): Promise<{ id: number | null; error: ServicedError | null }> {
  return withServiceErrors(
    'leave type lookup',
    async () => {
      const { data, error } = await supabase.from('leave_types').select('id').eq('name', name).single()
      return {
        id: data?.id ?? null,
        // Unknown type names are distinct from service failures.
        error: error?.code === 'PGRST116' ? null : normalizeSupabaseError(error, 'leave type lookup'),
      }
    },
    (error) => ({ id: null, error }),
    true
  )
}
