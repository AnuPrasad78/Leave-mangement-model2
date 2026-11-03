// Display-only mirror of backend/api/app/leave_policy.prorated_annual.
// The backend remains authoritative; label these values "estimate" where shown.
export const ANNUAL_DAYS_PER_YEAR = 22
export const PRORATION_METHOD = 'months_worked_of_12_half_up'

export function proportionalAnnual(doj: string | null | undefined, year: number): number {
  if (!doj) return ANNUAL_DAYS_PER_YEAR
  const [, joinMonth] = doj.split('-').map(Number)
  if (!Number.isFinite(joinMonth) || joinMonth < 1 || joinMonth > 12) return ANNUAL_DAYS_PER_YEAR
  const joinYear = Number(doj.slice(0, 4))
  if (joinYear < year) return ANNUAL_DAYS_PER_YEAR
  if (joinYear > year) return 0
  const monthsWorked = 12 - (joinMonth - 1)
  const exact = (ANNUAL_DAYS_PER_YEAR * monthsWorked) / 12
  // nearest 0.5, half-up, matching the backend's 0.5-day grid
  const rounded = Math.round(exact * 2) / 2
  return Math.min(Math.max(rounded, 0), ANNUAL_DAYS_PER_YEAR)
}
