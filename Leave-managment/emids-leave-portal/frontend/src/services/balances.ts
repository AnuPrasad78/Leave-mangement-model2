import { supabase } from '../lib/supabase'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { LeaveBalancesRow, ServicedError } from '../types/models'

export async function fetchLatestBalances(employeeId: string): Promise<{ row: LeaveBalancesRow | null; error: ServicedError | null }> {
  return withServiceErrors(
    'balances lookup',
    async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .order('year', { ascending: false })
        .limit(1)
      return { row: data?.[0] ?? null, error: normalizeSupabaseError(error, 'balances lookup') }
    },
    (error) => ({ row: null, error }),
    true
  )
}
