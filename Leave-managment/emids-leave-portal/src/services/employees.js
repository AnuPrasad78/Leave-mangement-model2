import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function fetchProfileByAuthId(uid) {
  const { data, error } = await supabase
    .from('employees')
    .select('*, manager:employees ( full_name )')
    .eq('auth_user_id', uid)
    .single()
  console.log('fetchProfileByAuthId', uid, data, error)

  // The same-table embed degrades to an empty array whenever PostgREST can't
  // resolve the employees <-> employees relationship in its schema cache, so
  // fall back to a direct read of the manager's name via profile.manager_id.
  const profile = error ? null : data
  if (profile?.manager_id && !profile?.manager?.full_name) {
    const { data: manager } = await supabase
      .from('employees')
      .select('full_name')
      .eq('id', profile.manager_id)
      .single()
    if (manager?.full_name) profile.manager = { full_name: manager.full_name }
  }

  return {
    profile,
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
