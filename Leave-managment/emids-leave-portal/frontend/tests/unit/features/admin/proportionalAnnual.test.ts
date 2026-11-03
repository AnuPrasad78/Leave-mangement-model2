import { proportionalAnnual, PRORATION_METHOD } from '../../../../src/features/admin/proportionalAnnual'

// Cases mirror backend/api/tests/test_leave_policy.py — the frontend copy is
// display-only and both must agree on the 0.5-day grid.
describe('features/admin/proportionalAnnual', () => {
  it('credits the full 22 for unknown or previous-year DOJ', () => {
    expect(proportionalAnnual(null, 2027)).toBe(22)
    expect(proportionalAnnual(undefined, 2027)).toBe(22)
    expect(proportionalAnnual('2026-06-01', 2027)).toBe(22)
  })

  it('credits nothing before the joining year', () => {
    expect(proportionalAnnual('2028-03-01', 2027)).toBe(0)
  })

  it('prorates by months worked with the joining month counted', () => {
    expect(proportionalAnnual('2027-01-01', 2027)).toBe(22)
    expect(proportionalAnnual('2027-07-01', 2027)).toBe(11)
    expect(proportionalAnnual('2027-03-02', 2027)).toBe(18.5)
    expect(proportionalAnnual('2027-03-20', 2027)).toBe(18.5)
    expect(proportionalAnnual('2027-08-01', 2027)).toBe(9)
    expect(proportionalAnnual('2027-12-31', 2027)).toBe(2)
  })

  it('declares the same proration method as the backend', () => {
    expect(PRORATION_METHOD).toBe('months_worked_of_12_half_up')
  })
})
