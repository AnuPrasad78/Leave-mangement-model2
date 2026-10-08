import { findNextHoliday, formatHolidayTicker } from '../../../../src/features/holidays/ticker'

const now = new Date('2026-10-08T14:33:00')

describe('features/holidays/findNextHoliday', () => {
  const fixed = { id: 1, kind: 'fixed', location: 'Bangalore, KA', name: 'Fixed Day' }
  const otherCity = { id: 2, kind: 'fixed', location: 'Chennai, TN', name: 'Far Away' }
  const unpickedOptional = { id: 3, kind: 'optional', name: 'Not Picked' }
  const pickedOptional = { id: 4, kind: 'optional', name: 'My Pick' }

  it('matches a fixed holiday in the profile city (comma location, case-insensitive)', () => {
    const picks = new Set()
    expect(findNextHoliday([otherCity, fixed], picks, 'Bangalore, KA')).toBe(fixed)
  })

  it('accepts any fixed holiday when the profile has no location', () => {
    expect(findNextHoliday([fixed], new Set(), '')).toBe(fixed)
    expect(findNextHoliday([fixed], new Set(), undefined)).toBe(fixed)
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
    expect(formatHolidayTicker({ name: 'Diwali', holiday_date: '2026-10-08', kind: 'fixed' }, now)).toEqual({
      name: 'Diwali',
      dateLabel: expect.stringContaining('OCT'),
      when: 'TODAY',
      kind: 'fixed',
    })
  })

  it('labels tomorrow TOMORROW and later dates IN N DAYS', () => {
    expect(formatHolidayTicker({ name: 'A', holiday_date: '2026-10-09', kind: 'optional' }, now).when).toBe('TOMORROW')
    expect(formatHolidayTicker({ name: 'B', holiday_date: '2026-10-14', kind: 'optional' }, now).when).toBe('IN 6 DAYS')
  })

  it('keeps the legacy no-past-date branch (IN -N DAYS) pinned', () => {
    expect(formatHolidayTicker({ name: 'Old', holiday_date: '2026-10-05', kind: 'fixed' }, now).when).toBe('IN -3 DAYS')
  })

  it('formats the en-GB date label in the pinned uppercase shape', () => {
    expect(formatHolidayTicker({ name: 'A', holiday_date: '2026-10-08', kind: 'fixed' }, now).dateLabel).toBe('THU 08 OCT')
  })

  it('returns null when there is no next holiday', () => {
    expect(formatHolidayTicker(null, now)).toBeNull()
  })
})
