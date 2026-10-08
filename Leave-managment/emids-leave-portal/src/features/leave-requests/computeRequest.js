import { businessDaysBetween } from '../../utils/dates'
import { MODES } from '../../constants'

export function computeRequestDays({ from, to, mode }) {
  if (!from || !to) return null
  if (to < from) return null
  const n = businessDaysBetween(from, to)
  if (mode !== MODES.Full) return Math.max(0.5, n * 0.5)
  return n
}

export function validateRequest({ type, from, to, reason }) {
  const errs = {}
  if (!type) errs.type = 'Select a leave type.'
  if (!from) errs.from = 'Pick a from date.'
  if (!to) errs.to = 'Pick a to date.'
  if (from && to && to < from) errs.to = 'End date is before the start date.'
  if (reason.trim().length < 5) errs.reason = 'Tell the approver why, in a line or two.'
  return errs
}
