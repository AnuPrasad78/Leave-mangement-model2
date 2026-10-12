import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { fetchLatestBalances } from '../../../src/services/balances'

beforeEach(() => mockDb.reset())

describe('services/balances', () => {
  it('returns the latest balance row or null', async () => {
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e1'], data: [{ year: 2026, annual_credited: 18 }] })
    const { row, error } = await fetchLatestBalances('e1')
    expect(error).toBeNull()
    expect(row).toEqual({ year: 2026, annual_credited: 18 })
  })

  it('returns null row when no balance exists (not an error)', async () => {
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e1'], data: [] })
    const { row, error } = await fetchLatestBalances('e1')
    expect(row).toBeNull()
    expect(error).toBeNull()
  })
})
