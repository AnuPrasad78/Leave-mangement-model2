import { businessDaysBetween } from '../../utils/dates'
import { MODES } from '../../constants'
import type { LeaveMode } from '../../types/models'

export function computeRequestDays({
  from,
  to,
  mode,
  fixedHolidayDates = [],
}: {
  from: string
  to: string
  mode: LeaveMode
  fixedHolidayDates?: readonly string[]
}): number | null {
  if (!from || !to) return null
  if (to < from) return null
  const n = businessDaysBetween(from, to, fixedHolidayDates)
  if (mode !== MODES.Full) {
    if (from === to && fixedHolidayDates.includes(from)) return 0
    return Math.max(0.5, n * 0.5)
  }
  return n
}

export type RequestValidationErrors = Partial<Record<'type' | 'from' | 'to' | 'reason', string>>

export function validateRequest({ type, from, to, reason }: { type: string; from: string; to: string; reason: string }): RequestValidationErrors {
  const errs: RequestValidationErrors = {}
  if (!type) errs.type = 'Select a leave type.'
  if (!from) errs.from = 'Pick a from date.'
  if (!to) errs.to = 'Pick a to date.'
  if (from && to && to < from) errs.to = 'End date is before the start date.'
  if (reason.trim().length < 5) errs.reason = 'Tell the approver why, in a line or two.'
  return errs
}
