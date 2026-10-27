import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { LeaveBalancesRow, ServicedError } from '../types/models'

export async function fetchLatestBalances(_employeeId: string): Promise<{ row: LeaveBalancesRow | null; error: ServicedError | null }> {
  return withServiceErrors(
    'balances lookup',
    async () => {
      const row = await apiRequest<LeaveBalancesRow | null>('/balances/me')
      return { row, error: null }
    },
    (error) => ({ row: null, error }),
    true
  )
}
