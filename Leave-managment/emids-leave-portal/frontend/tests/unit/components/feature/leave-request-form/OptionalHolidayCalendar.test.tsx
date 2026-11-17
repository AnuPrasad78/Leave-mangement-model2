import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import OptionalHolidayCalendar from '@/components/feature/leave-request-form/OptionalHolidayCalendar'
import { todayISO } from '@/utils/dates'

function iso(offsetDays: number): string {
  const d = todayISO().slice(0, 10)
  const base = new Date(d + 'T00:00:00')
  base.setDate(base.getDate() + offsetDays)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

function setup(options: Map<string, string>, selected = '') {
  const onSelect = vi.fn()
  render(<OptionalHolidayCalendar options={options} selected={selected} onSelect={onSelect} />)
  return { onSelect }
}

describe('components/feature/leave-request-form/OptionalHolidayCalendar', () => {
  it('renders the picker with the current month by default', () => {
    setup(new Map())
    expect(screen.getByRole('group', { name: 'Optional holiday picker' })).toBeInTheDocument()
    expect(screen.getByText(/20\d\d/)).toBeInTheDocument()
  })

  it('enables only the configurable optional holidays', () => {
    const future = iso(10)
    setup(new Map([[future, 'Guru Nanak Jayanti']]))
    const day = screen.getByRole('button', { name: `${future} — Guru Nanak Jayanti` })
    expect(day).toBeEnabled()
  })

  it('disables ordinary dates that are not configured optional holidays', () => {
    const ordinary = iso(5)
    const future = iso(10)
    setup(new Map([[future, 'Festival X']]))
    expect(screen.getByTitle(ordinary)).toBeDisabled()
  })

  it('disables past configured holidays even though they are configured', () => {
    const past = iso(-3)
    setup(new Map([[past, 'Maha Shivaratri']]))
    const day = screen.getByRole('button', { name: `${past} — Maha Shivaratri (past)` })
    expect(day).toBeDisabled()
  })

  it("keeps today selectable when it is a configured optional holiday", () => {
    const today = todayISO()
    const { onSelect } = setup(new Map([[today, 'Today Special']]))
    const day = screen.getByRole('button', { name: `${today} — Today Special` })
    expect(day).toBeEnabled()
    fireEvent.click(day)
    expect(onSelect).toHaveBeenCalledWith(today)
  })

  it('publishes the date when a configured holiday is clicked', () => {
    const future = iso(12)
    const { onSelect } = setup(new Map([[future, 'Holi']]))
    fireEvent.click(screen.getByRole('button', { name: `${future} — Holi` }))
    expect(onSelect).toHaveBeenCalledWith(future)
  })

  it('marks the selected configured date', () => {
    const future = iso(9)
    setup(new Map([[future, 'Holi']]), future)
    expect(screen.getByRole('button', { name: `${future} — Holi` })).toHaveClass('opt-calendar__day--selected')
  })
})
