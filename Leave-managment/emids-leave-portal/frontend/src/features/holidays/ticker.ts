import type { HolidayKind, HolidaysRow } from '../../types/models'

// The ticker consumes the narrower holiday subset that fetchUpcomingHolidays selects.
export type TickerHolidayRow = Pick<HolidaysRow, 'id' | 'kind' | 'holiday_date' | 'name' | 'location'>

export interface HolidayTickerView {
  name: string
  dateLabel: string
  when: string
  kind: HolidayKind
}

export function findNextHoliday(
  rows: readonly TickerHolidayRow[],
  picks: Set<number> | null,
  location: string | null
): TickerHolidayRow | null {
  const city = (location ?? '').split(',')[0].trim().toLowerCase()
  return (
    rows.find((h) =>
      h.kind === 'optional'
        ? picks?.has(h.id)
        : !city || String(h.location ?? '').toLowerCase().includes(city)
    ) ?? null
  )
}

export function formatHolidayTicker(nextHoliday: TickerHolidayRow | null, now: Date = new Date()): HolidayTickerView | null {
  if (!nextHoliday) return null
  const d = new Date(`${nextHoliday.holiday_date}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  return {
    name: nextHoliday.name,
    dateLabel: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase(),
    when: diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : `IN ${diff} DAYS`,
    kind: nextHoliday.kind,
  }
}
