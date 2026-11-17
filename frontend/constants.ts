// Mirrors the Postgres enums/values defined in backend/supabase/schema.sql.
// Statuses/modes/roles live in the DB; these literals keep the client in sync.
// `as const` lets src/types/models.ts derive literal unions from these values.
export const STATUSES = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
} as const

export const MODES = {
  Full: 'Full Day',
  FirstHalf: 'First Half',
  SecondHalf: 'Second Half',
} as const

export const ROLES = {
  Employee: 'employee',
  Manager: 'manager',
  Admin: 'admin',
} as const

export const TOAST_KIND = {
  Ok: 'ok',
  Error: 'red',
} as const

// Enforced again by the DB trigger optional_picks_max_three
export const MAX_PICKS = 3

export const separationReasons = [
  'Better Opportunity',
  'Higher Studies',
  'Personal Reasons',
  'Health Reasons',
  'Relocation',
  'Entrepreneurship',
  'Career Break',
  'Other',
] as const
