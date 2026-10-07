import { supabase } from '../lib/supabase'
import { normalizeSupabaseError } from './errors'

export async function fetchLatestBalances(employeeId) {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .order('year', { ascending: false })
    .limit(1)
  return {
    row: data?.[0] ?? null,
    error: normalizeSupabaseError(error, 'balances lookup'),
  }
}
