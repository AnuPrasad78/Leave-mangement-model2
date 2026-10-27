import { todayISO } from '../../utils/dates'

export type SeparationValidationErrors = Partial<Record<'lwd' | 'reason', string>>

export function validateSeparation({ lwd, reason, today = todayISO() }: { lwd?: string; reason?: string; today?: string } = {}): SeparationValidationErrors {
  const errs: SeparationValidationErrors = {}
  if (!lwd) errs.lwd = 'Pick your proposed last working day.'
  if (lwd && lwd < today) errs.lwd = 'Last working day must be in the future.'
  if (!reason) errs.reason = 'Select a reason for separation.'
  return errs
}
