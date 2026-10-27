import { describe, expect, it } from 'vitest'
import { buildSearchIndex, filterHits, MAX_HITS } from '../../../../src/features/search/searchEverything'
import { STATUSES } from '../../../../src/constants'
import type { LeaveRequestRow, TeamRequestRow } from '../../../../src/types/models'

const mineRow = (over: Partial<LeaveRequestRow> = {}): LeaveRequestRow => ({
  id: 'LV-2026-00001',
  type: 'Annual Leave',
  from: '2026-11-02',
  to: '2026-11-04',
  days: 3,
  mode: 'Full Day',
  reason: 'Family function',
  requestedOn: '2026-10-01',
  decidedOn: null,
  status: STATUSES.Pending,
  ...over,
})

const teamRow = (over: Partial<TeamRequestRow> = {}): TeamRequestRow => ({
  ...mineRow(),
  name: 'Priya Nair',
  empId: 'EM-20440',
  absenceType: 'Annual Leave',
  ...over,
})

const NAV = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: () => null },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: () => null },
  { to: '/leave-requests', num: '4', label: 'Leave Requests', icon: () => null },
]

const mine = [
  mineRow(),
  mineRow({ id: 'LV-2026-00002', type: 'Work From Home', reason: 'Internet outage', status: STATUSES.Approved, requestedOn: '2026-10-05' }),
]

const team = [teamRow(), teamRow({ id: 'LV-2026-00007', name: 'Ashok Verma', empId: 'EM-20450', status: STATUSES.Approved })]

describe('features/search searchEverything', () => {
  it('indexes nav pages and own requests for a plain employee', () => {
    const index = buildSearchIndex(NAV, 'employee', mine, [])
    const sections = [...new Set(index.map((e) => e.section))]
    expect(sections).toEqual(['Pages', 'My requests'])
    expect(index.filter((e) => e.section === 'Pages')).toHaveLength(NAV.length)
    expect(index.filter((e) => e.section === 'My requests')).toHaveLength(2)
  })

  it('adds team hits only for approvers, pointing at the queue route', () => {
    const employeeIndex = buildSearchIndex(NAV, 'employee', mine, team)
    expect(employeeIndex.some((e) => e.section === 'Team requests')).toBe(false)

    const managerIndex = buildSearchIndex(NAV, 'manager', mine, team)
    const teamHits = managerIndex.filter((e) => e.section === 'Team requests')
    expect(teamHits).toHaveLength(2)
    expect(teamHits.every((e) => e.to === '/leave-requests')).toBe(true)
  })

  it('shows nothing for an empty or blank query (the overlay shows its idle hint)', () => {
    const index = buildSearchIndex(NAV, 'manager', mine, team)
    for (const query of ['', '   ', '\t']) {
      expect(filterHits(index, query)).toEqual([])
    }
  })

  it('requires every whitespace-separated token, case-insensitively', () => {
    const index = buildSearchIndex(NAV, 'employee', mine, [])
    expect(filterHits(index, 'annual FAMILY').map((h) => h.title)).toEqual(['LV-2026-00001 · Annual Leave'])
    expect(filterHits(index, 'annual function approved')).toEqual([])
    expect(filterHits(index, 'APPROVED').map((h) => h.title)).toEqual(['LV-2026-00002 · Work From Home'])
  })

  it('matches request numbers and reviewer-visible metadata (reason, emp id)', () => {
    const managerIndex = buildSearchIndex(NAV, 'manager', mine, team)
    expect(filterHits(managerIndex, 'lv-2026-00007')).toHaveLength(1)
    expect(filterHits(managerIndex, 'outage').map((h) => h.title)).toEqual(['LV-2026-00002 · Work From Home'])
    expect(filterHits(managerIndex, 'priya')).toHaveLength(1)

    const employeeIndex = buildSearchIndex(NAV, 'employee', mine, [])
    expect(filterHits(employeeIndex, 'priya')).toEqual([])
  })

  it('renders request hits with dates, status and route targets', () => {
    const index = buildSearchIndex(NAV, 'employee', mine, [])
    const hit = filterHits(index, 'internet outage')[0]
    expect(hit.meta).toContain('02 Nov 2026–04 Nov 2026')
    expect(hit.meta).toContain('Approved')
    expect(hit.to).toBe('/leave-details')
  })

  it('never throws on regex-hostile query text and stays substring-based', () => {
    const index = buildSearchIndex(NAV, 'manager', mine, team)
    const hostile = 'LV-2026-00001 .*[]("; DROP'
    expect(() => filterHits(index, hostile)).not.toThrow()
    expect(filterHits(index, hostile)).toEqual([])
  })

  it('caps results at MAX_HITS to keep the overlay nimble', () => {
    const lots = Array.from({ length: MAX_HITS + 10 }, (_, i) =>
      mineRow({ id: `LV-2026-0${String(i + 10).padStart(3, '0')}`, type: 'Annual Leave' })
    )
    const index = buildSearchIndex(NAV, 'employee', lots, [])
    expect(filterHits(index, 'annual')).toHaveLength(MAX_HITS)
  })

  it('renders an empty index gracefully (no data loaded)', () => {
    const index = buildSearchIndex([], 'employee', [], [])
    expect(index).toEqual([])
    expect(filterHits(index, 'anything')).toEqual([])
  })
})
