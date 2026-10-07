import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function fetchAllHolidays() {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, country, location, year, kind, holiday_date, name')
    .order('holiday_date')
  return { rows: data ?? [], error: normalizeSupabaseError(error, 'holidays lookup') }
}

export async function fetchUpcomingHolidays(fromISO) {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, kind, holiday_date, name, location')
    .gte('holiday_date', fromISO)
    .order('holiday_date')
  return { rows: data ?? [], error: normalizeSupabaseError(error, 'upcoming holidays') }
}

export async function fetchOptionalPicks(employeeId) {
  const { data, error } = await supabase
    .from('optional_holiday_picks')
    .select('holiday_id')
    .eq('employee_id', employeeId)
  return {
    holidayIds: (data ?? []).map((r) => r.holiday_id),
    error: normalizeSupabaseError(error, 'optional picks lookup'),
  }
}

export async function addOptionalPick(employeeId, holidayId) {
  const { error } = await supabase.from('optional_holiday_picks').insert({ employee_id: employeeId, holiday_id: holidayId })
  return { error: normalizeSupabaseError(error, 'optional pick') }
}

export async function removeOptionalPick(employeeId, holidayId) {
  const { error } = await supabase
    .from('optional_holiday_picks')
    .delete()
    .eq('employee_id', employeeId)
    .eq('holiday_id', holidayId)
  return { error: normalizeSupabaseError(error, 'optional pick removal') }
}

export function isPickCapError(error) {
  if (!error) return false
  return error.code === 'P0001' || /optional holiday/i.test(error.userMessage ?? '')
}
