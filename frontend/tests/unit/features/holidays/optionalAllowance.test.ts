import { consumedOptionalHolidays, isOptionalHolidayType, remainingOptionalHolidays } from '@/features/holidays/optionalAllowance'
import type { LeaveRequestRow } from '@/types/models'

const OPT = 'Optional Holiday'

function row(overrides: Partial<LeaveRequestRow> & Pick<LeaveRequestRow, 'id' | 'status'>): LeaveRequestRow {
  return {
    type: OPT,
    from: '2027-01-05',
    to: '2027-01-05',
    days: 1,
    mode: 'Full Day',
    reason: 'festival',
    requestedOn: '2027-01-01',
    ...({} as const),
    ...overrides,
  } as LeaveRequestRow
}

describe('features/holidays/optionalAllowance', () => {
  it('counts Pending and Approved requests toward the allowance', () => {
    const rows = [
      row({ id: 'LV-1', status: 'Pending' }),
      row({ id: 'LV-2', status: 'Approved', from: '2027-02-10' }),
    ]
    expect(consumedOptionalHolidays(rows, 2027)).toBe(2)
  })

  it('ignores Rejected and Cancelled requests', () => {
    const rows = [
      row({ id: 'LV-1', status: 'Rejected' }),
      row({ id: 'LV-2', status: 'Cancelled' }),
      row({ id: 'LV-3', status: 'Pending' }),
    ]
    expect(consumedOptionalHolidays(rows, 2027)).toBe(1)
  })

  it('counts per year of the from date', () => {
    const rows = [
      row({ id: 'LV-1', status: 'Approved', from: '2026-12-31' }),
      row({ id: 'LV-2', status: 'Approved', from: '2027-01-01' }),
    ]
    expect(consumedOptionalHolidays(rows, 2027)).toBe(1)
    expect(consumedOptionalHolidays(rows, 2026)).toBe(1)
  })

  it('ignores other leave types even when their day is the same', () => {
    const rows = [
      row({ id: 'LV-1', status: 'Approved', type: 'Paid Time Off' }),
    ]
    expect(consumedOptionalHolidays(rows, 2027)).toBe(0)
  })

  it('excludes the request being edited from its own count', () => {
    const rows = [
      row({ id: 'LV-edit', status: 'Pending', from: '2027-05-01' }),
      row({ id: 'LV-2', status: 'Approved', from: '2027-06-01' }),
    ]
    expect(consumedOptionalHolidays(rows, 2027, 'LV-edit')).toBe(1)
  })

  it('remaining clamps at zero and hides when the policy max is unknown', () => {
    const rows = [
      row({ id: 'LV-1', status: 'Approved' }),
      row({ id: 'LV-2', status: 'Pending' }),
      row({ id: 'LV-3', status: 'Approved', from: '2027-03-03' }),
      row({ id: 'LV-4', status: 'Approved', from: '2027-04-04' }),
    ]
    expect(remainingOptionalHolidays(rows, 2027, 3)).toBe(0)
    expect(remainingOptionalHolidays(rows, 2027, 3, 'LV-1')).toBe(0)
    expect(remainingOptionalHolidays(rows, 2027, null)).toBeNull()
    expect(remainingOptionalHolidays(rows, 2027, 3, 'LV-4')).toBe(0)
  })

  it('identifies the optional holiday type name case-insensitively', () => {
    expect(isOptionalHolidayType('Optional Holiday')).toBe(true)
    expect(isOptionalHolidayType('optional holiday')).toBe(true)
    expect(isOptionalHolidayType('Paid Time Off')).toBe(false)
  })
})
