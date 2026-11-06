import { fmtDate, dayName, businessDaysBetween, todayISO } from '../../../src/utils/dates'

describe('utils/dates', () => {
  describe('fmtDate (pinned: current data.js behavior)', () => {
    it('formats ISO date as en-GB dd MMM yyyy', () => {
      expect(fmtDate('2026-01-05')).toBe('05 Jan 2026')
      expect(fmtDate('2026-12-31')).toBe('31 Dec 2026')
      expect(fmtDate('2026-06-01')).toBe('01 Jun 2026')
    })
  })

  describe('dayName (pinned: current data.js behavior)', () => {
    it('returns the short weekday for ISO date', () => {
      // 2026-01-05 is a Monday, 2026-01-10 a Saturday
      expect(dayName('2026-01-05')).toBe('Mon')
      expect(dayName('2026-01-10')).toBe('Sat')
    })
  })

  describe('businessDaysBetween (pinned: inclusive, weekday-only)', () => {
    it('counts the same weekday date as 1 (inclusive)', () => {
      expect(businessDaysBetween('2026-01-05', '2026-01-05')).toBe(1) // Mon
    })
    it('counts a full Mon-Fri week as 5', () => {
      expect(businessDaysBetween('2026-01-05', '2026-01-09')).toBe(5)
    })
    it('spans weekends without counting them', () => {
      expect(businessDaysBetween('2026-01-05', '2026-01-11')).toBe(5) // Mon→Sun
      expect(businessDaysBetween('2026-01-09', '2026-01-12')).toBe(2) // Fri→Mon
      expect(businessDaysBetween('2026-01-10', '2026-01-11')).toBe(0) // Sat→Sun
    })
    it('returns 0 for an inverted range', () => {
      expect(businessDaysBetween('2026-01-09', '2026-01-05')).toBe(0)
    })
  })

  describe('todayISO (new: local calendar date, fixes UTC off-by-one)', () => {
    it('returns the local calendar date as YYYY-MM-DD', () => {
      const d = new Date()
      const expected =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
      expect(todayISO()).toBe(expected)
    })
  })
})
