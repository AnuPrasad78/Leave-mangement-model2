import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { migrateLegacyPicks } from '../../../src/services/legacyMigration'
import type { HolidaysRow } from '../../../src/types/models'
import type { LegacyHolidayData } from '../../../src/data/legacyHolidayData'

beforeEach(() => resetApiClientMock())

const storage = (raw: string | null) => {
  const mem = new Map(raw ? [['emids-optional-holidays', raw]] : [])
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    removeItem: (k: string) => mem.delete(k),
  }
}

describe('services/legacyMigration', () => {
  it('is a no-op without a legacy storage entry', async () => {
    const { inserted } = await migrateLegacyPicks({ employeeId: 'e1', all: [], pickedIds: [], legacyData: {}, storage: storage(null) })
    expect(inserted).toBeNull()
  })

  it('maps legacy per-cell indices to holiday ids and inserts them', async () => {
    const all: HolidaysRow[] = [
      { id: 1, country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-11-01', name: 'Kannada Rajyotsava', location: null },
      { id: 2, country: 'USA', year: 2025, kind: 'optional', holiday_date: '2025-11-05', name: 'Diwali', location: null },
    ]
    const legacyData = { India: { optional: { 2025: [{ date: '2025-11-01', name: 'Kannada Rajyotsava' }] } } } as unknown as LegacyHolidayData
    apiRequest.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce([1])

    const { inserted, pickedIds } = await migrateLegacyPicks({
      employeeId: 'e1',
      all,
      pickedIds: [],
      legacyData,
      storage: storage('{"India|2025":[0]}'),
    })
    expect(inserted).toEqual([{ employee_id: 'e1', holiday_id: 1 }])
    expect(pickedIds).toEqual([1])
  })

  it('skips candidates beyond the remaining per-year budget', async () => {
    const all: HolidaysRow[] = [
      { id: 1, country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-11-01', name: 'A', location: null },
      { id: 2, country: 'India', year: 2025, kind: 'optional', holiday_date: '2025-12-25', name: 'B', location: null },
      { id: 3, country: 'India', year: 2025, kind: 'optional', holiday_date: '2026-01-14', name: 'C', location: null },
      { id: 4, country: 'India', year: 2025, kind: 'optional', holiday_date: '2026-01-26', name: 'D', location: null },
    ]
    const optional = all.map((x) => ({ date: x.holiday_date, name: x.name }))
    const legacyData = { India: { optional: { 2025: optional } } } as unknown as LegacyHolidayData
    apiRequest.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce([1, 2, 3])

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
