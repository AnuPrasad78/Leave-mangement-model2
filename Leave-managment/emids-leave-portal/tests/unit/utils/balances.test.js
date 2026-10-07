import { balanceValue } from '../../../src/utils/balances'

// Replaces the per-page balance arithmetic duplicated in Layout.jsx:145/149,
// Dashboard.jsx:96 and ApplyLeave.jsx:26 — rows come pre-clamped from toBalances.
describe('utils/balances', () => {
  const balances = {
    totalCredited: 18,
    utilized: 2.5,
    rows: [
      { key: 'contAvailable', label: 'Cont. Available', value: 9, max: 10 },
      { key: 'available', label: 'Available', value: 15.5, max: 18 },
    ],
  }

  it('reads a pool value by key', () => {
    expect(balanceValue(balances, 'contAvailable')).toBe(9)
    expect(balanceValue(balances, 'available')).toBe(15.5)
  })

  it('falls back to 0 for missing key / missing rows / null balances', () => {
    expect(balanceValue(balances, 'unknown')).toBe(0)
    expect(balanceValue({ totalCredited: 18 }, 'available')).toBe(0)
    expect(balanceValue(null, 'available')).toBe(0)
  })
})
