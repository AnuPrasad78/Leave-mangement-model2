// Mirrors the Postgres enums/values defined in supabase/schema.sql.
// Statuses/modes/roles live in the DB; these literals keep the client in sync.
export const STATUSES = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
}

export const MODES = {
  Full: 'Full Day',
  FirstHalf: 'First Half',
  SecondHalf: 'Second Half',
}

export const ROLES = {
  Employee: 'employee',
  Manager: 'manager',
  Admin: 'admin',
}

export const TOAST_KIND = {
  Ok: 'ok',
  Error: 'red',
}

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
]
