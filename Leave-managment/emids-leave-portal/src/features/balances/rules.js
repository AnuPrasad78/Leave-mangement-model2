import { balanceValue } from '../../utils/balances'

export function isOverdrawn(balances) {
  return !!balances && balances.utilized > balances.totalCredited
}

export function remainingAfter(balances, days) {
  if (days == null) return null
  if (!balances) return null
  return balanceValue(balances, 'available') - days
}

export const EMPTY_BALANCES = { totalCredited: 0, utilized: 0, rows: [] }
