import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { ServicedError } from '../types/models'

export async function fetchActiveLeaveTypeNames(): Promise<{ names: string[]; error: ServicedError | null }> {
  return withServiceErrors(
    'leave types lookup',
    async () => {
      const data = await apiRequest<Array<{ id: number; name: string }>>('/leave-types')
      return { names: data.map((row) => row.name), error: null }
    },
    (error) => ({ names: [], error }),
    true
  )
}

export async function fetchLeaveTypeIdByName(name: string): Promise<{ id: number | null; error: ServicedError | null }> {
  return withServiceErrors(
    'leave type lookup',
    async () => {
      const data = await apiRequest<Array<{ id: number; name: string }>>('/leave-types')
      return { id: data.find((row) => row.name === name)?.id ?? null, error: null }
    },
    (error) => ({ id: null, error }),
    true
  )
}
