import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function fetchProfileByAuthId(uid) {
  const { data, error } = await supabase
    .from('employees')
    .select('*, manager:employees ( full_name )')
    .eq('auth_user_id', uid)
    .single()
  return {
    profile: error ? null : data,
    error: normalizeSupabaseError(error, 'profile lookup'),
  }
}

export async function fetchReportIds(managerId) {
  const { data, error } = await supabase.from('employees').select('id').eq('manager_id', managerId)
  return {
    ids: (data ?? []).map((r) => r.id),
    error: normalizeSupabaseError(error, 'team lookup'),
  }
}
