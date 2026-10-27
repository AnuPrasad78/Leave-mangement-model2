import { fmtDays } from '../../../src/utils/format'

// Pinned to the current Layout.jsx fmtDays semantics (duplicated page-wide today):
// integers render bare, everything else with exactly 2 decimals.
describe('utils/format', () => {
  it('renders integers without decimals', () => {
    expect(fmtDays(18)).toBe('18')
    expect(fmtDays(0)).toBe('0')
  })
  it('renders non-integers with 2 decimals (Layout semantics)', () => {
    expect(fmtDays(0.5)).toBe('0.50')
    expect(fmtDays(12.34)).toBe('12.34')
  })
})
