import { validateRequest } from '@/features/leave-requests/computeRequest'
import { todayISO } from '@/utils/dates'
import type { LeaveRequestRow } from '@/types/models'

const OPT = 'Optional Holiday'
const TODAY = todayISO()

function shiftISO(days: number): string {
  const base = new Date(TODAY + 'T00:00:00')
  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

const base = { type: OPT, from: '', to: '', reason: '', optionalHolidays: undefined, mine: undefined, optionalAllowance: undefined }

describe('features/leave-requests/validateRequest (optional holiday gate)', () => {
  it('asks to wait while the optional-holiday configuration loads', () => {
    const errs = validateRequest({ ...base, from: TODAY, to: TODAY, reason: 'Festival visit home town' })
    expect(errs.from).toBe('Optional holiday dates are still loading — try again in a moment.')
  })

  it('rejects a date that is not a configured optional holiday', () => {
    const future = shiftISO(30)
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[shiftISO(31), 'Holi']]),
    })
    expect(errs.from).toBe('This date is not a configured optional holiday. Pick one from the calendar.')
  })

  it('accepts a configured optional holiday in the future', () => {
    const future = shiftISO(30)
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[future, 'Holi']]),
    })
    expect(Object.keys(errs)).toHaveLength(0)
  })

  it('rejects a past configured optional holiday', () => {
    const past = shiftISO(-5)
    const errs = validateRequest({
      ...base,
      from: past,
      to: past,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[past, 'Maha Shivaratri']]),
    })
    expect(errs.from).toBe('Optional holidays cannot be applied for in the past.')
  })

  it('keeps the single-day rule', () => {
    const errs = validateRequest({
      ...base,
      from: TODAY,
      to: shiftISO(2),
      reason: 'Festival visit home town',
      optionalHolidays: new Map(),
    })
    expect(errs.to).toBe('Optional holidays are single-day requests — set To to the same date as From.')
  })

  it('rejects when the allowance is exhausted for the picked year', () => {
    const future = shiftISO(30)
    const mine: LeaveRequestRow[] = [
      { id: 'LV-1', type: OPT, from: shiftISO(10), to: shiftISO(10), days: 1, mode: 'Full Day', reason: 'a', requestedOn: TODAY, status: 'Pending' },
      { id: 'LV-2', type: OPT, from: shiftISO(11), to: shiftISO(11), days: 1, mode: 'Full Day', reason: 'b', requestedOn: TODAY, status: 'Approved' },
      { id: 'LV-3', type: OPT, from: shiftISO(12), to: shiftISO(12), days: 1, mode: 'Full Day', reason: 'c', requestedOn: TODAY, status: 'Approved' },
    ]
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[future, 'Holi']]),
      mine,
      optionalAllowance: 3,
    })
    expect(errs.from).toBe('You have used all your Optional Holidays for this year.')
  })

  it('ignores rejected and cancelled requests when counting the allowance', () => {
    const future = shiftISO(30)
    const mine: LeaveRequestRow[] = [
      { id: 'LV-1', type: OPT, from: shiftISO(10), to: shiftISO(10), days: 1, mode: 'Full Day', reason: 'a', requestedOn: TODAY, status: 'Rejected' },
      { id: 'LV-2', type: OPT, from: shiftISO(11), to: shiftISO(11), days: 1, mode: 'Full Day', reason: 'b', requestedOn: TODAY, status: 'Cancelled' },
      { id: 'LV-3', type: OPT, from: shiftISO(12), to: shiftISO(12), days: 1, mode: 'Full Day', reason: 'c', requestedOn: TODAY, status: 'Approved' },
      { id: 'LV-4', type: OPT, from: shiftISO(13), to: shiftISO(13), days: 1, mode: 'Full Day', reason: 'd', requestedOn: TODAY, status: 'Pending' },
    ]
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[future, 'Holi']]),
      mine,
      optionalAllowance: 3,
    })
    expect(Object.keys(errs)).toHaveLength(0)
  })

  it('does not count the request being edited', () => {
    const future = shiftISO(30)
    const mine: LeaveRequestRow[] = [
      { id: 'LV-1', type: OPT, from: shiftISO(10), to: shiftISO(10), days: 1, mode: 'Full Day', reason: 'a', requestedOn: TODAY, status: 'Pending' },
      { id: 'LV-2', type: OPT, from: shiftISO(11), to: shiftISO(11), days: 1, mode: 'Full Day', reason: 'b', requestedOn: TODAY, status: 'Approved' },
      { id: 'LV-3', type: OPT, from: shiftISO(12), to: shiftISO(12), days: 1, mode: 'Full Day', reason: 'c', requestedOn: TODAY, status: 'Approved' },
    ]
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[future, 'Holi']]),
      mine,
      optionalAllowance: 3,
      excludeRequestId: 'LV-1',
    })
    expect(Object.keys(errs)).toHaveLength(0)
  })

  it('skips the allowance check while the policy cap is unknown', () => {
    const future = shiftISO(30)
    const errs = validateRequest({
      ...base,
      from: future,
      to: future,
      reason: 'Festival visit home town',
      optionalHolidays: new Map([[future, 'Holi']]),
      optionalAllowance: null,
    })
    expect(Object.keys(errs)).toHaveLength(0)
  })

  it('applies nothing of the optional gate to non-optional leave types', () => {
    const errs = validateRequest({
      type: 'Paid Time Off',
      from: TODAY,
      to: TODAY,
      reason: 'Not feeling well',
    })
    expect(Object.keys(errs)).toHaveLength(0)
  })
})
