import { businessDaysBetween, todayISO } from '../../utils/dates'
import { MODES } from '../../constants'
import type { LeaveMode } from '../../types/models'
import { isOptionalHolidayType, remainingOptionalHolidays } from '../holidays/optionalAllowance'
import type { LeaveRequestRow } from '../../types/models'

export function computeRequestDays({
  from,
  to,
  mode,
  isOptionalHoliday,
}: {
  from: string
  to: string
  mode: LeaveMode
  isOptionalHoliday?: boolean
}): number | null {
  if (!from || !to) return null
  if (to < from) return null
  // Leave taken ABOUT an optional holiday is always a leave day, even when
  // the holiday itself lands on a weekend — business-day math would say 0.
  if (isOptionalHoliday && from === to) return mode !== MODES.Full ? 0.5 : 1
  const n = businessDaysBetween(from, to)
  if (mode !== MODES.Full) return Math.max(0.5, n * 0.5)
  return n
}

export type RequestValidationErrors = Partial<Record<'type' | 'from' | 'to' | 'reason', string>>

export function validateRequest({
  type,
  from,
  to,
  reason,
  optionalHolidays,
  mine,
  optionalAllowance,
  excludeRequestId,
}: {
  type: string
  from: string
  to: string
  reason: string
  /** Date → name map of the configured optional holidays (Holidays page).
   * Omitted only while the configuration is still loading. */
  optionalHolidays?: Map<string, string>
  /** Own leave requests — feeds the allowance count. */
  mine?: LeaveRequestRow[]
  /** Optional-holiday allowance cap from backend policy; null = unknown. */
  optionalAllowance?: number | null
  /** While editing: the request being edited must not count against itself. */
  excludeRequestId?: string
}): RequestValidationErrors {
  const errs: RequestValidationErrors = {}
  const today = todayISO()
  if (!type) errs.type = 'Select a leave type.'
  if (!from) errs.from = 'Pick a from date.'
  if (!to) errs.to = 'Pick a to date.'
  if (from && to && to < from) errs.to = 'End date is before the start date.'
  if (from && from < today && !isOptionalHolidayType(type)) {
    errs.from = 'Leave cannot be applied for in the past.'
  }
  if (reason.trim().length < 5) errs.reason = 'Tell the approver why, in a line or two.'
  if (!errs.type && !errs.from && !errs.to && isOptionalHolidayType(type)) {
    if (from !== to) {
      errs.to = 'Optional holidays are single-day requests — set To to the same date as From.'
    } else if (!optionalHolidays) {
      errs.from = 'Optional holiday dates are still loading — try again in a moment.'
    } else if (!optionalHolidays.has(from)) {
      errs.from = 'This date is not a configured optional holiday. Pick one from the calendar.'
    } else if (from < today) {
      errs.from = 'Optional holidays cannot be applied for in the past.'
    } else if (optionalAllowance != null) {
      const year = Number(from.slice(0, 4))
      const remaining = remainingOptionalHolidays(mine ?? [], year, optionalAllowance, excludeRequestId)
      if (remaining != null && remaining <= 0) {
        errs.from = 'You have used all your Optional Holidays for this year.'
      }
    }
  }
  return errs
}
