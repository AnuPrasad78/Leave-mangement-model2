import { isOverdrawn, remainingAfter, EMPTY_BALANCES } from '../../../../src/features/balances/rules'
import type { BalanceSummary } from '../../../../src/types/models'

describe('features/balances/isOverdrawn', () => {
  it('is false when balances are missing', () => {
    expect(isOverdrawn(null)).toBe(false)
    expect(isOverdrawn(undefined as unknown as BalanceSummary | null)).toBe(false)
  })

  it('blocks when utilized exceeds credited total', () => {
    expect(isOverdrawn({ utilized: 14, totalCredited: 12, rows: [] } as BalanceSummary)).toBe(true)
  })

  it('allows utilized exactly at or below the credited total', () => {
    expect(isOverdrawn({ utilized: 12, totalCredited: 12, rows: [] } as BalanceSummary)).toBe(false)
    expect(isOverdrawn({ utilized: 5, totalCredited: 12, rows: [] } as BalanceSummary)).toBe(false)
  })
})

describe('features/balances/remainingAfter', () => {
  const balances: BalanceSummary = { utilized: 14, totalCredited: 12, rows: [{ key: 'available', label: 'Available', value: 10, max: 18 }] }

  it('subtracts the selected days from available', () => {
    expect(remainingAfter(balances, 2.5)).toBe(7.5)
    expect(remainingAfter(balances, 10)).toBe(0)
  })

  it('is null when days are unknown or balances are missing', () => {
    expect(remainingAfter(balances, null)).toBeNull()
    expect(remainingAfter(null, 2)).toBeNull()
  })
})

describe('features/balances/EMPTY_BALANCES', () => {
  it('keeps the pinned zeroed shape', () => {
    expect(EMPTY_BALANCES).toEqual({ totalCredited: 0, utilized: 0, rows: [] })
  })
})
