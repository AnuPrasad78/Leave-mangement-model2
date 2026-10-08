import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'
import { STATUSES } from '../constants'

// Embed select shared by fetchMine / fetchTeam; the mappers in src/store
// consume the exact shape this selects.
const REQUEST_FIELDS =
  'request_no, employee_id, start_date, end_date, days, mode, reason, status, requested_on, ' +
  'leave_types!leave_requests_leave_type_id_fkey(name), ' +
  'employees!leave_requests_employee_id_fkey(full_name, emp_no)'

export async function fetchMine(employeeId) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(REQUEST_FIELDS)
    .eq('employee_id', employeeId)
    .order('requested_on', { ascending: false })
    .order('id', { ascending: false })
  return { rows: data ?? [], error: normalizeSupabaseError(error, 'my requests') }
}

export async function fetchTeam(employeeIds) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(REQUEST_FIELDS)
    .in('employee_id', employeeIds)
    .order('requested_on', { ascending: false })
    .order('id', { ascending: false })
  return { rows: data ?? [], error: normalizeSupabaseError(error, 'team requests') }
}

export async function insertMine(payload) {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert(payload)
    .select('request_no')
    .single()
  return { requestNo: data?.request_no ?? null, error: normalizeSupabaseError(error, 'submit request') }
}

export async function cancelMine(requestNo, employeeId) {
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: STATUSES.Cancelled })
    .eq('request_no', requestNo)
    .eq('employee_id', employeeId)
  return { error: normalizeSupabaseError(error, 'cancel request') }
}

export async function decide(requestNo, decision, approverId) {
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: decision, approver_id: approverId, decided_at: new Date().toISOString() })
    .eq('request_no', requestNo)
  return { error: normalizeSupabaseError(error, 'decision') }
}

export async function decideMany(requestNos, decision, approverId) {
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: decision, approver_id: approverId, decided_at: new Date().toISOString() })
    .in('request_no', requestNos)
  return { error: normalizeSupabaseError(error, 'bulk decision') }
}
