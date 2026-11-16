import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { EmployeeProfileRow, ServicedError } from '../types/models'

// Discriminated success/error shape: the store branch is `if (error) … else use profile`,
// so profile and error are mutually exclusive at this seam (mirrors supabase-js's own
// { data, error } single-response contract).
export async function fetchProfileByAuthId(_uid: string): Promise<
  { profile: null; error: ServicedError; warning: null } | { profile: EmployeeProfileRow; error: null; warning: ServicedError | null }
> {
  const result = await withServiceErrors(
    'profile lookup',
    async () => {
      const data = await apiRequest<EmployeeProfileRow>('/employees/me')
      return { data, error: null }
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
  return {
    profile: data as EmployeeProfileRow,
    error: null,
    warning: null,
  }
}

export async function fetchReportIds(_managerId: string): Promise<{ ids: string[]; error: ServicedError | null }> {
  return withServiceErrors(
    'team lookup',
    async () => {
      const data = await apiRequest<Array<{ id: string }>>('/employees/me/team')
      return { ids: data.map((row) => row.id), error: null }
    },
    (error) => ({ ids: [], error }),
    true
  )
}
