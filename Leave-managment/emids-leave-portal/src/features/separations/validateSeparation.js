import { todayISO } from '../../utils/dates'

export function validateSeparation({ lwd, reason, today = todayISO() } = {}) {
  const errs = {}
  if (!lwd) errs.lwd = 'Pick your proposed last working day.'
  if (lwd && lwd < today) errs.lwd = 'Last working day must be in the future.'
  if (!reason) errs.reason = 'Select a reason for separation.'
  return errs
}
