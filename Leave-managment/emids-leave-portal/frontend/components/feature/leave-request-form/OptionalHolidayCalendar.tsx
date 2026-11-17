import { useState } from 'react'
import { IconChevronDown } from '../../Icons'
import { todayISO } from '../../../utils/dates'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Monday-first column index of a Date (getDay() is Sunday-first).
const monFirst = (d: Date): number => (d.getDay() + 6) % 7

export interface OptionalHolidayCalendarProps {
  /** Configured optional holidays from the Holidays configuration: date → name. */
  options: Map<string, string>
  selected: string
  onSelect: (dateISO: string) => void
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Month grid for the Optional Holiday leave type: only the configured
 * optional holidays (today onward — past holidays are locked out) are
 * highlighted and clickable; every other day is inert decoration. */
export default function OptionalHolidayCalendar({ options, selected, onSelect }: OptionalHolidayCalendarProps) {
  const today = todayISO()
  // Anchor the month view on the selection (or today) so the picker opens in
  // the month that matters; own state otherwise, arrows navigate freely.
  const anchor = selected ?? ''
  const [viewYear, setViewYear] = useState<number | null>(null)
  const [viewMonth, setViewMonth] = useState<number | null>(null)
  const year = viewYear ?? (anchor ? Number(anchor.slice(0, 4)) : Number(today.slice(0, 4)))
  const month = viewMonth ?? (anchor ? Number(anchor.slice(5, 7)) - 1 : Number(today.slice(5, 7)) - 1)

  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = monFirst(first)

  const cells: (string | null)[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${pad2(month + 1)}-${pad2(day)}`)

  const step = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="opt-calendar" role="group" aria-label="Optional holiday picker">
      <div className="opt-calendar__head">
        <button type="button" className="opt-calendar__nav" aria-label="Previous month" onClick={() => step(-1)}>
          <IconChevronDown size={14} />
        </button>
        <span className="opt-calendar__month">{MONTHS[month]} {year}</span>
        <button type="button" className="opt-calendar__nav opt-calendar__nav--next" aria-label="Next month" onClick={() => step(1)}>
          <IconChevronDown size={14} />
        </button>
      </div>

      <div className="opt-calendar__grid">
        {DOW.map((d, i) => (
          <span key={`dow-${i}`} className="opt-calendar__dow">{d}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />
          const name = options.get(date)
          const isPast = date < today
          const isSelectable = Boolean(name) && !isPast
          const isSelected = date === selected
          return (
            <button
              key={date}
              type="button"
              className={[
                'opt-calendar__day',
                isSelectable ? 'opt-calendar__day--picked' : 'opt-calendar__day--muted',
                isSelected ? 'opt-calendar__day--selected' : '',
              ].filter(Boolean).join(' ')}
              disabled={!isSelectable}
              title={name == null ? date : isPast ? `${name} — this optional holiday has passed` : name}
              aria-label={name ? `${date} — ${name}${isPast ? ' (past)' : ''}` : date}
              aria-pressed={isSelected || undefined}
              onClick={() => onSelect(date)}
            >
              {Number(date.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
