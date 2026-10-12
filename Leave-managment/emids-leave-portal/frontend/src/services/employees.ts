import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { EmployeeProfileRow, ServicedError } from '../types/models'

// Discriminated success/error shape: the store branch is `if (error) … else use profile`,
// so profile and error are mutually exclusive at this seam (mirrors supabase-js's own
// { data, error } single-response contract).
export async function fetchProfileByAuthId(uid: string): Promise<
  { profile: null; error: ServicedError; warning: null } | { profile: EmployeeProfileRow; error: null; warning: ServicedError | null }
> {
  const result = await withServiceErrors(
    'profile lookup',
    async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, manager:employees ( full_name )')
        .eq('auth_user_id', uid)
        .single()
      return { data, error: normalizeSupabaseError(error, 'profile lookup') }
    },
    (error) => ({ data: null, error }),
    true
  )
  const { data, error } = result

  if (error) return { profile: null, error, warning: null }

  // The same-table embed degrades to an empty array whenever PostgREST can't
  // resolve the employees <-> employees relationship in its schema cache, so
  // fall back to a direct read of the manager's name via profile.manager_id.
  // The typed client infers this self-FK embed as an ARRAY (its generic model
  // has no one-to-one same-table path), while the wire sends an object on a
  // cache hit — normalize once at this boundary.
  const profile = data as unknown as EmployeeProfileRow
  if (profile?.manager_id && !profile?.manager?.full_name) {
    const managerResult = await withServiceErrors(
      'manager lookup',
      async () => {
        const { data, error } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', profile.manager_id!)
          .single()
        return { data, error: normalizeSupabaseError(error, 'manager lookup') }
      },
      (error) => ({ data: null, error }),
      true
    )
    const manager = managerResult.data
    if (manager?.full_name) profile.manager = { full_name: manager.full_name }
    if (managerResult.error) return { profile, error: null, warning: managerResult.error }
  }

  return {
    profile,
    error: null,
    warning: null,
  }
}

export async function fetchReportIds(managerId: string): Promise<{ ids: string[]; error: ServicedError | null }> {
  return withServiceErrors(
    'team lookup',
    async () => {
      const { data, error } = await supabase.from('employees').select('id').eq('manager_id', managerId)
      return { ids: (data ?? []).map((r) => r.id), error: normalizeSupabaseError(error, 'team lookup') }
    },
    (error) => ({ ids: [], error }),
    true
  )
}
