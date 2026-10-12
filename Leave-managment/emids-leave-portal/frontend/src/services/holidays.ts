import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { HolidaysRow, ServicedError } from '../types/models'
import type { TickerHolidayRow } from '../features/holidays/ticker'

export async function fetchAllHolidays(): Promise<{ rows: HolidaysRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'holidays lookup',
    async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('id, country, location, year, kind, holiday_date, name')
        .order('holiday_date')
      return { rows: (data ?? []) as HolidaysRow[], error: normalizeSupabaseError(error, 'holidays lookup') }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchUpcomingHolidays(fromISO: string): Promise<{ rows: TickerHolidayRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'upcoming holidays',
    async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('id, kind, holiday_date, name, location')
        .gte('holiday_date', fromISO)
        .order('holiday_date')
      return { rows: (data ?? []) as TickerHolidayRow[], error: normalizeSupabaseError(error, 'upcoming holidays') }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchOptionalPicks(employeeId: string): Promise<{ holidayIds: number[]; error: ServicedError | null }> {
  return withServiceErrors(
    'optional picks lookup',
    async () => {
      const { data, error } = await supabase
        .from('optional_holiday_picks')
        .select('holiday_id')
        .eq('employee_id', employeeId)
      return { holidayIds: (data ?? []).map((r) => r.holiday_id), error: normalizeSupabaseError(error, 'optional picks lookup') }
    },
    (error) => ({ holidayIds: [], error }),
    true
  )
}

export async function addOptionalPick(employeeId: string, holidayId: number): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'optional pick',
    async () => {
      const { error } = await supabase.from('optional_holiday_picks').insert({ employee_id: employeeId, holiday_id: holidayId })
      return { error: normalizeSupabaseError(error, 'optional pick') }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function removeOptionalPick(employeeId: string, holidayId: number): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'optional pick removal',
    async () => {
      const { error } = await supabase
        .from('optional_holiday_picks')
        .delete()
        .eq('employee_id', employeeId)
        .eq('holiday_id', holidayId)
      return { error: normalizeSupabaseError(error, 'optional pick removal') }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export function isPickCapError(error: ServicedError | null | undefined): boolean {
  if (!error) return false
  return error.code === 'P0001' || /optional holiday/i.test(error.userMessage ?? '')
}
