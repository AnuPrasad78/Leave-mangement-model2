import { STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons } from '../../src/constants'

// Contract pins — these mirror the Postgres enums in supabase/schema.sql.
// If the schema changes, these tests change with it (never silently).
describe('src/constants', () => {
  it('pins request statuses', () => {
    expect(STATUSES).toEqual({
      Pending: 'Pending',
      Approved: 'Approved',
      Rejected: 'Rejected',
      Cancelled: 'Cancelled',
    })
  })
  it('pins day modes', () => {
    expect(MODES).toEqual({ Full: 'Full Day', FirstHalf: 'First Half', SecondHalf: 'Second Half' })
  })
  it('pins system roles', () => {
    expect(ROLES).toEqual({ Employee: 'employee', Manager: 'manager', Admin: 'admin' })
  })
  it('pins toast kinds', () => {
    expect(TOAST_KIND).toEqual({ Ok: 'ok', Error: 'red' })
  })
  it('pins the optional-holiday pick cap', () => {
    expect(MAX_PICKS).toBe(3)
  })
  it('pins separation reasons (current data.js list)', () => {
    expect(separationReasons).toEqual([
      'Better Opportunity',
      'Higher Studies',
      'Personal Reasons',
      'Health Reasons',
      'Relocation',
      'Entrepreneurship',
      'Career Break',
      'Other',
    ])
  })
})
