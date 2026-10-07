import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { migrateLegacyPicks } from '../../../src/services/legacyMigration'

beforeEach(() => mockDb.reset())

const storage = (raw) => {
  const mem = new Map(raw ? [['emids-optional-holidays', raw]] : [])
  return {
    getItem: (k) => mem.get(k) ?? null,
    removeItem: (k) => mem.delete(k),
  }
}

describe('services/legacyMigration', () => {
  it('is a no-op without a legacy storage entry', async () => {
    const { inserted } = await migrateLegacyPicks({ employeeId: 'e1', all: [], pickedIds: [], legacyData: {}, storage: storage(null) })
    expect(inserted).toBeNull()
  })

  it('maps legacy per-cell indices to holiday ids and inserts them', async () => {
    const all = [
      { id: 'hA', country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-11-01', name: 'Kannada Rajyotsava' },
      { id: 'hB', country: 'USA', year: 2025, kind: 'optional', holiday_date: '2025-11-05', name: 'Diwali' },
    ]
    const legacyData = { India: { optional: { 2025: [{ date: '2025-11-01', name: 'Kannada Rajyotsava' }] } } }
    mockDb.expectInsert('optional_holiday_picks', { data: null })
    mockDb.expectSelect('optional_holiday_picks', { eq: ['employee_id', 'e1'], data: [{ holiday_id: 'hA' }] })

    const { inserted, pickedIds } = await migrateLegacyPicks({
      employeeId: 'e1',
      all,
      pickedIds: [],
      legacyData,
      storage: storage('{"India|2025":[0]}'),
    })
    expect(inserted).toEqual([{ employee_id: 'e1', holiday_id: 'hA' }])
    expect(pickedIds).toEqual(['hA'])
  })

  it('skips candidates beyond the remaining per-year budget', async () => {
    const all = [
      { id: 'hA', country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-11-01', name: 'A' },
      { id: 'hB', country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-12-25', name: 'B' },
      { id: 'hC', country: 'India', year: 2025, kind: 'optional', holiday_date: '2026-01-14', name: 'C' },
      { id: 'hD', country: 'India', year: 2025, kind: 'optional', holiday_date: '2026-01-26', name: 'D' },
    ]
    const optional = all.map((x) => ({ date: x.holiday_date, name: x.name }))
    const legacyData = { India: { optional: { 2025: optional } } }
    mockDb.expectInsert('optional_holiday_picks', { data: null })
    mockDb.expectSelect('optional_holiday_picks', { eq: ['employee_id', 'e1'], data: [{ holiday_id: 'hA' }, { holiday_id: 'hB' }, { holiday_id: 'hC' }] })

    const { inserted } = await migrateLegacyPicks({
      employeeId: 'e1',
      all,
      pickedIds: [],
      legacyData,
      storage: storage('{"India|2025":[0,1,2,3]}'),
    })
    expect(inserted).toHaveLength(3)
  })
})
