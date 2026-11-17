import { STATUSES } from '../../constants'
import type { LeaveRequestRow, RequestStatus } from '../../types/models'

/** Statuses that consume the optional-holiday allowance. Rejected/Cancelled
 * (and any withdrawn state) hand the holiday back; Pending holds it in
 * reserve so two applications on 3 picked days can't slip past the cap. */
export const OPTIONAL_CONSUMING_STATUSES: readonly RequestStatus[] = [
  STATUSES.Pending,
  STATUSES.Approved,
]

export const OPTIONAL_STATUS_CONSUMES: ReadonlySet<string> = new Set<string>(
  OPTIONAL_CONSUMING_STATUSES
)

export function isOptionalHolidayType(type: string): boolean {
  return type.toLowerCase().includes('optional holiday')
}

/** How many optional holidays the employee has consumed in `year`
 * (Pending and Approved count; the rest release the allowance).
 * `excludeId` drops the request being edited so it doesn't hold itself back. */
export function consumedOptionalHolidays(
  rows: LeaveRequestRow[],
  year: number,
  excludeId?: string
): number {
  return rows.filter(
    (row) =>
      isOptionalHolidayType(row.type) &&
      OPTIONAL_STATUS_CONSUMES.has(row.status) &&
      Number(row.from.slice(0, 4)) === year &&
      row.id !== excludeId
  ).length
}

/** Remaining allowance for `year`, clamped at 0. `max == null` (policy not
 * loaded) yields null so the UI can hide the line instead of guessing. */
export function remainingOptionalHolidays(
  rows: LeaveRequestRow[],
  year: number,
  max: number | null,
  excludeId?: string
): number | null {
  if (max == null) return null
  return Math.max(0, max - consumedOptionalHolidays(rows, year, excludeId))
}
