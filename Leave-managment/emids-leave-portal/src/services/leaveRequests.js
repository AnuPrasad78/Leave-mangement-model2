import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'
import { REQUEST_FIELDS } from '../store/mappings'
import { STATUSES } from '../constants'

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
