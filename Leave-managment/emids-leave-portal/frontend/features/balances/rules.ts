import { balanceValue } from '../../utils/balances'
import type { BalanceSummary } from '../../types/models'

export function isOverdrawn(balances: BalanceSummary | null): boolean {
  return !!balances && balances.utilized > balances.totalCredited
}

export function remainingAfter(balances: BalanceSummary | null, days: number | null | undefined): number | null {
  if (days == null) return null
  if (!balances) return null
  return balanceValue(balances, 'available') - days
}

export const EMPTY_BALANCES: BalanceSummary = { totalCredited: 0, utilized: 0, rows: [] }
