import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function fetchActiveLeaveTypeNames() {
  const { data, error } = await supabase
    .from('leave_types')
    .select('name')
    .eq('is_active', true)
    .order('id')
  return {
    names: (data ?? []).map((r) => r.name),
    error: normalizeSupabaseError(error, 'leave types lookup'),
  }
}

export async function fetchLeaveTypeIdByName(name) {
  const { data, error } = await supabase.from('leave_types').select('id').eq('name', name).single()
  return {
    id: data?.id ?? null,
    // unknown type names (no row) are not an error for the caller — the caller
    // decides the wording, e.g. "Unknown leave type: X"
    error: error?.code === 'PGRST116' ? null : normalizeSupabaseError(error, 'leave type lookup'),
  }
}
