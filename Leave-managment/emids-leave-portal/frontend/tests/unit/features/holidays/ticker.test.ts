import { findNextHoliday, formatHolidayTicker } from '../../../../src/features/holidays/ticker'
import type { TickerHolidayRow } from '../../../../src/features/holidays/ticker'

const now = new Date('2026-10-08T14:33:00')

describe('features/holidays/findNextHoliday', () => {
  const fixed: TickerHolidayRow = { id: 1, kind: 'fixed', location: 'Bangalore, KA', holiday_date: '2026-10-08', name: 'Fixed Day' }
  const otherCity: TickerHolidayRow = { id: 2, kind: 'fixed', location: 'Chennai, TN', holiday_date: '2026-10-08', name: 'Far Away' }
  const unpickedOptional: TickerHolidayRow = { id: 3, kind: 'optional', location: null, holiday_date: '2026-10-12', name: 'Not Picked' }
  const pickedOptional: TickerHolidayRow = { id: 4, kind: 'optional', location: null, holiday_date: '2026-10-11', name: 'My Pick' }

  it('matches a fixed holiday in the profile city (comma location, case-insensitive)', () => {
    const picks = new Set<number>()
    expect(findNextHoliday([otherCity, fixed], picks, 'Bangalore, KA')).toBe(fixed)
  })

  it('accepts any fixed holiday when the profile has no location', () => {
    expect(findNextHoliday([fixed], new Set(), '')).toBe(fixed)
    expect(findNextHoliday([fixed], new Set(), undefined as unknown as string | null)).toBe(fixed)
  })

  it('skips optional holidays unless they are among the picks', () => {
    const rows = [otherCity, unpickedOptional, pickedOptional]
    expect(findNextHoliday(rows, new Set([4]), 'Bangalore, KA')).toBe(pickedOptional)
    expect(findNextHoliday([otherCity, unpickedOptional], new Set([4]), 'Bangalore, KA')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(findNextHoliday([unpickedOptional], new Set(), '')).toBeNull()
  })
})

describe('features/holidays/formatHolidayTicker', () => {
  it('labels the same-day holiday TODAY', () => {
    expect(formatHolidayTicker({ id: 5, name: 'Diwali', holiday_date: '2026-10-08', location: null, kind: 'fixed' }, now)).toEqual({
      name: 'Diwali',
      dateLabel: expect.stringContaining('OCT'),
      when: 'TODAY',
      kind: 'fixed',
    })
  })

  it('labels tomorrow TOMORROW and later dates IN N DAYS', () => {
    expect(formatHolidayTicker({ id: 6, name: 'A', holiday_date: '2026-10-09', location: null, kind: 'optional' }, now)!.when).toBe('TOMORROW')
    expect(formatHolidayTicker({ id: 7, name: 'B', holiday_date: '2026-10-14', location: null, kind: 'optional' }, now)!.when).toBe('IN 6 DAYS')
  })

  it('keeps the legacy no-past-date branch (IN -N DAYS) pinned', () => {
    expect(formatHolidayTicker({ id: 8, name: 'Old', holiday_date: '2026-10-05', location: null, kind: 'fixed' }, now)!.when).toBe('IN -3 DAYS')
  })

  it('formats the en-GB date label in the pinned uppercase shape', () => {
    expect(formatHolidayTicker({ id: 9, name: 'A', holiday_date: '2026-10-08', location: null, kind: 'fixed' }, now)!.dateLabel).toBe('THU 08 OCT')
  })

  it('returns null when there is no next holiday', () => {
    expect(formatHolidayTicker(null, now)).toBeNull()
  })
})
