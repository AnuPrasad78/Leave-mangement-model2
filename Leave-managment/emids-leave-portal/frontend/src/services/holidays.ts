import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { HolidaysRow, ServicedError } from '../types/models'
import type { TickerHolidayRow } from '../features/holidays/ticker'

export async function fetchAllHolidays(): Promise<{ rows: HolidaysRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'holidays lookup',
    async () => {
      const rows = await apiRequest<HolidaysRow[]>('/holidays')
      
      return { rows, error: null }
      
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchUpcomingHolidays(fromISO: string): Promise<{ rows: TickerHolidayRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'upcoming holidays',
    async () => {
      const rows = await apiRequest<TickerHolidayRow[]>(`/holidays/upcoming?from_date=${encodeURIComponent(fromISO)}`)
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchOptionalPicks(_employeeId: string): Promise<{ holidayIds: number[]; error: ServicedError | null }> {
  return withServiceErrors(
    'optional picks lookup',
    async () => {
      const holidayIds = await apiRequest<number[]>('/holidays/picks')
      return { holidayIds, error: null }
    },
    (error) => ({ holidayIds: [], error }),
    true
  )
}

export async function addOptionalPick(_employeeId: string, holidayId: number): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'optional pick',
    async () => {
      await apiRequest('/holidays/picks', {
        method: 'POST',
        body: JSON.stringify({ holiday_id: holidayId }),
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function removeOptionalPick(_employeeId: string, holidayId: number): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'optional pick removal',
    async () => {
      await apiRequest(`/holidays/picks/${holidayId}`, { method: 'DELETE' })
      return { error: null }
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
