// Single reader for the shaped balances rows produced by store/mappings.js
// (rows are pre-clamped by toBalances).
export const balanceRow = (balances, key) => balances?.rows?.find((r) => r.key === key) ?? null

export const balanceValue = (balances, key) => balanceRow(balances, key)?.value ?? 0
