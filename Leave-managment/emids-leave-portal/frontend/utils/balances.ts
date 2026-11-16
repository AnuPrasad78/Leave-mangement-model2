import type { BalanceBarRow, BalanceSummary } from '../types/models'

// Single reader for the shaped balances rows produced by store/mappings.ts
// (rows are pre-clamped by toBalances).
export const balanceRow = (balances: BalanceSummary | null, key: string): BalanceBarRow | null =>
  balances?.rows?.find((r) => r.key === key) ?? null

export const balanceValue = (balances: BalanceSummary | null, key: string): number =>
  balanceRow(balances, key)?.value ?? 0
