import { businessDaysBetween } from '../../utils/dates'
import { MODES } from '../../constants'
import type { LeaveMode } from '../../types/models'

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
  pickedOptionalHolidays,
}: {
  type: string
  from: string
  to: string
  reason: string
  /** Date → name map of the user's optional-holiday picks from the Holiday
   * Calendar. Omitted only when the data is unavailable. */
  pickedOptionalHolidays?: Map<string, string>
}): RequestValidationErrors {
  const errs: RequestValidationErrors = {}
  if (!type) errs.type = 'Select a leave type.'
  if (!from) errs.from = 'Pick a from date.'
  if (!to) errs.to = 'Pick a to date.'
  if (from && to && to < from) errs.to = 'End date is before the start date.'
  if (reason.trim().length < 5) errs.reason = 'Tell the approver why, in a line or two.'
  if (!errs.type && !errs.from && !errs.to && type.toLowerCase().includes('optional holiday')) {
    if (from !== to) {
      errs.to = 'Optional holidays are single-day requests — set To to the same date as From.'
    } else if (!pickedOptionalHolidays) {
      errs.from = 'Your optional holiday picks are still loading — try again in a moment.'
    } else {
      const name = pickedOptionalHolidays.get(from)
      if (!name) {
        errs.from = 'This date is not one of your selected optional holidays. Select it in the Holiday Calendar first.'
      }
    }
  }
  return errs
}
