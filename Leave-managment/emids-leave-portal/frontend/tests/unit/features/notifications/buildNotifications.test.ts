import { describe, expect, it } from 'vitest'
import { buildNotifications } from '../../../../src/features/notifications/buildNotifications'
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

describe('features/notifications buildNotifications', () => {
  const TODAY = '2026-10-27'

  it('surfaces pending team approvals for an approver, targeting the queue', () => {
    const items = buildNotifications(
      { system_role: 'manager' },
      [mineRow()],
      [
        teamRow(),
        teamRow({ id: 'LV-2026-00007', name: 'Ashok Verma', empId: 'EM-20450', absenceType: 'Work From Home', status: STATUSES.Approved }),
      ]
    )
    expect(items).toHaveLength(1)
    const approval = items[0]
    expect(approval.kind).toBe('approval')
    expect(approval.key).toBe('approval:LV-2026-00001')
    expect(approval.status).toBe(STATUSES.Pending)
    expect(approval.to).toBe('/leave-requests')
    expect(approval.title).toBe('Priya Nair — Annual Leave')
    expect(approval.meta).toContain('3 days')
    expect(approval.meta).toContain('Ref LV-2026-00001')
  })

  it('skips the approvals section for employees and for null profiles', () => {
    const team = [teamRow()]
    expect(buildNotifications({ system_role: 'employee' }, [], team)).toEqual([])
    expect(buildNotifications(null, [], team)).toEqual([])
    expect(buildNotifications(undefined, [], team)).toEqual([])
  })

  it('reports the latest decisions on own requests, capped at five, newest decided first', () => {
    const mine = [
      mineRow({ id: 'LV-A', status: STATUSES.Approved, requestedOn: '2026-10-21', decidedOn: '2026-10-23T09:30:00+00:00' }),
      mineRow({ id: 'LV-B', status: STATUSES.Rejected, requestedOn: '2026-10-25', decidedOn: '2026-10-26T14:00:00+00:00' }),
      mineRow({ id: 'LV-C', status: STATUSES.Pending, requestedOn: '2026-10-15', decidedOn: null }), // never notified
      mineRow({ id: 'LV-D', status: STATUSES.Cancelled, requestedOn: '2026-10-16', decidedOn: null }), // never notified
    ]
    for (let i = 0; i < 6; i++) {
      mine.push(
        mineRow({
          id: `LV-OLD-${i}`,
          status: STATUSES.Approved,
          requestedOn: '2026-10-20',
          decidedOn: `2026-10-21T0${i}:00:00+00:00`,
          type: 'Work From Home',
        })
      )
    }
    const items = buildNotifications({ system_role: 'employee' }, mine, [], TODAY)
    expect(items).toHaveLength(5)
    expect(items.every((n) => n.kind === 'decision')).toBe(true)
    expect(items.every((n) => n.to === '/leave-details')).toBe(true)
    expect(items[0].title).toBe('LV-B — Annual Leave')
    expect(items[1].title).toBe('LV-A — Annual Leave')
    expect(items.map((n) => n.key)).not.toContain('decision:LV-C:Pending')
    expect(items.map((n) => n.key)).not.toContain(expect.stringContaining('Cancelled'))
  })

  it('orders decisions by when they were decided, not when they were requested', () => {
    const mine = [
      mineRow({ id: 'LV-OLDREQ', status: STATUSES.Approved, requestedOn: '2026-09-10', decidedOn: '2026-10-27T08:00:00+00:00' }),
      mineRow({ id: 'LV-NEWREQ', status: STATUSES.Rejected, requestedOn: '2026-10-26', decidedOn: '2026-10-26T18:00:00+00:00' }),
    ]
    const items = buildNotifications({ system_role: 'employee' }, mine, [], TODAY)
    expect(items[0].title).toBe('LV-OLDREQ — Annual Leave')
    expect(items[1].title).toBe('LV-NEWREQ — Annual Leave')
  })

  it('drops decisions older than the 7-day recency window so re-login stays current', () => {
    const mine = [
      mineRow({ id: 'LV-FRESH', status: STATUSES.Approved, requestedOn: '2026-10-21', decidedOn: '2026-10-22T10:00:00+00:00' }),
      mineRow({ id: 'LV-STALE', status: STATUSES.Approved, requestedOn: '2026-10-01', decidedOn: '2026-10-19T23:59:59+00:00' }),
    ]
    const items = buildNotifications({ system_role: 'employee' }, mine, [], TODAY)
    expect(items.map((n) => n.key)).toEqual(['decision:LV-FRESH:Approved'])
  })

  it('falls back to requestedOn when a decided row has no decided_at', () => {
    const mine = [
      mineRow({ id: 'LV-NODEC', status: STATUSES.Approved, requestedOn: '2026-10-25', decidedOn: null }),
    ]
    const items = buildNotifications({ system_role: 'employee' }, mine, [], TODAY)
    expect(items.map((n) => n.title)).toEqual(['LV-NODEC — Annual Leave'])
  })

  it('caps pending approvals at ten, newest first', () => {
    const team = Array.from({ length: 12 }, (_, i) =>
      teamRow({ id: `LV-K-${String(i).padStart(2, '0')}`, requestedOn: `2026-10-${String(10 + i).padStart(2, '0')}` })
    )
    const items = buildNotifications({ system_role: 'manager' }, [], team, TODAY)
    expect(items).toHaveLength(10)
    expect(items[0].key).toBe('approval:LV-K-11')
    expect(items[9].key).toBe('approval:LV-K-02')
  })

  it('keys a decision by (request, status) so a status change re-raises the badge', () => {
    const items = buildNotifications(
      { system_role: 'employee' },
      [mineRow({ status: STATUSES.Approved, requestedOn: '2026-10-25', decidedOn: null })],
      [],
      TODAY
    )
    expect(items[0].key).toBe('decision:LV-2026-00001:Approved')

    const after = buildNotifications(
      { system_role: 'employee' },
      [mineRow({ status: STATUSES.Rejected, requestedOn: '2026-10-25', decidedOn: null })],
      [],
      TODAY
    )
    expect(after[0].key).toBe('decision:LV-2026-00001:Rejected')
    expect(after[0].status).toBe(STATUSES.Rejected)
  })

  it('counts a half day into the approval meta without pluralising zeros away', () => {
    const items = buildNotifications(
      { system_role: 'manager' },
      [],
      [teamRow({ days: 1 })]
    )
    expect(items[0].meta).toContain('1 day')
  })

  it('returns an empty list for an empty session (no crash on missing data)', () => {
    expect(buildNotifications(null, [], [])).toEqual([])
    expect(buildNotifications({ system_role: 'admin' }, [], [])).toEqual([])
  })
})
