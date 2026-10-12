import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import { STATUSES } from '../constants'
import type { LeaveRequestSelectRow, LeaveRequestsInsert, RequestDecision, ServicedError } from '../types/models'

// Embed select shared by fetchMine / fetchTeam; the mappers in src/store
// consume the exact shape this selects. A single literal (not a runtime
// concatenation) so the supabase-js generic query parser reconstructs the
// embedded leave_types / employees shapes.
const REQUEST_FIELDS = 'request_no, employee_id, start_date, end_date, days, mode, reason, status, requested_on, leave_types!leave_requests_leave_type_id_fkey(name), employees!leave_requests_employee_id_fkey(full_name, emp_no)'

export async function fetchMine(employeeId: string): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'my requests',
    async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(REQUEST_FIELDS)
        .eq('employee_id', employeeId)
        .order('requested_on', { ascending: false })
        .order('id', { ascending: false })
      return { rows: (data ?? []) as LeaveRequestSelectRow[], error: normalizeSupabaseError(error, 'my requests') }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchTeam(employeeIds: string[]): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'team requests',
    async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(REQUEST_FIELDS)
        .in('employee_id', employeeIds)
        .order('requested_on', { ascending: false })
        .order('id', { ascending: false })
      return { rows: (data ?? []) as LeaveRequestSelectRow[], error: normalizeSupabaseError(error, 'team requests') }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function insertMine(payload: LeaveRequestsInsert): Promise<{ requestNo: string | null; error: ServicedError | null }> {
  return withServiceErrors(
    'submit request',
    async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert(payload)
        .select('request_no')
        .single()
      return { requestNo: data?.request_no ?? null, error: normalizeSupabaseError(error, 'submit request') }
    },
    (error) => ({ requestNo: null, error }),
    false,
    true
  )
}

export async function cancelMine(requestNo: string, employeeId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'cancel request',
    async () => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: STATUSES.Cancelled })
        .eq('request_no', requestNo)
        .eq('employee_id', employeeId)
      return { error: normalizeSupabaseError(error, 'cancel request') }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function decide(requestNo: string, decision: RequestDecision, approverId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'decision',
    async () => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: decision, approver_id: approverId, decided_at: new Date().toISOString() })
        .eq('request_no', requestNo)
      return { error: normalizeSupabaseError(error, 'decision') }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function decideMany(requestNos: string[], decision: RequestDecision, approverId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'bulk decision',
    async () => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: decision, approver_id: approverId, decided_at: new Date().toISOString() })
        .in('request_no', requestNos)
      return { error: normalizeSupabaseError(error, 'bulk decision') }
    },
    (error) => ({ error }),
    false,
    true
  )
}
