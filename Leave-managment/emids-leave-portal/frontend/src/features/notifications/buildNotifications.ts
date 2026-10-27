// Pure notification rules for the header bell.
//
// Derives the actionable items for the signed-in viewer from state the session
// already holds: pending team approvals (approvers only) and recent decisions
// on the viewer's own requests. No service calls, no store imports.
import { STATUSES } from '../../constants'
import { canApprove } from '../../utils/roles'
import { fmtDate, todayISO } from '../../utils/dates'
import type { EmployeeProfileRow, LeaveRequestRow, RequestStatus, TeamRequestRow } from '../../types/models'

export type NotificationKind = 'approval' | 'decision'

export interface NotificationItem {
  /** stable per (request, state) — a status change re-raises an unseen badge */
  key: string
  kind: NotificationKind
  title: string
  meta: string
  status: RequestStatus
  to: string
}

type ViewerLike = Pick<EmployeeProfileRow, 'system_role'>

const DECISION_STATUSES: RequestStatus[] = [STATUSES.Approved, STATUSES.Rejected]

/** Noisy history is capped — the bell is a heads-up, not a second inbox. */
const MAX_DECISIONS = 5
const MAX_APPROVALS = 10

/** Decisions surface for a week after they were made, then age out. */
export const DECISION_RECENT_DAYS = 7

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const descNewest = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0)

/** `YYYY-MM-DD` days before the anchor, via UTC-anchored arithmetic. */
const isoDaysBefore = (anchor: string, days: number): string => {
  const d = new Date(`${anchor}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export function buildNotifications(
  profile: ViewerLike | null | undefined,
  mine: LeaveRequestRow[],
  team: TeamRequestRow[],
  today: string = todayISO()
): NotificationItem[] {
  const items: NotificationItem[] = []

  if (canApprove(profile)) {
    team
      .filter((r) => r.status === STATUSES.Pending)
      .sort((a, b) => (a.requestedOn === b.requestedOn ? descNewest(a.id, b.id) : descNewest(a.requestedOn, b.requestedOn)))
      .slice(0, MAX_APPROVALS)
      .forEach((r) => {
        items.push({
          key: `approval:${r.id}`,
          kind: 'approval',
          title: `${r.name} — ${r.absenceType}`,
          meta: `Ref ${r.id} · ${fmtDate(r.from)}–${fmtDate(r.to)} · ${plural(r.days, 'day')}`,
          status: r.status,
          to: '/leave-requests',
        })
      })
  }

  const cutoff = isoDaysBefore(today, DECISION_RECENT_DAYS)
  const decisions = mine
    .filter((r) => DECISION_STATUSES.includes(r.status))
    .map((r) => ({ row: r, decidedOn: (r.decidedOn ?? r.requestedOn).slice(0, 10) }))
    .sort((a, b) => (a.decidedOn === b.decidedOn ? descNewest(a.row.id, b.row.id) : descNewest(a.decidedOn, b.decidedOn)))
    .filter((d) => d.decidedOn >= cutoff)
    .slice(0, MAX_DECISIONS)

  decisions.forEach(({ row: r }) => {
    items.push({
      key: `decision:${r.id}:${r.status}`,
      kind: 'decision',
      title: `${r.id} — ${r.type}`,
      meta: `${fmtDate(r.from)}–${fmtDate(r.to)} · requested ${fmtDate(r.requestedOn)}`,
      status: r.status,
      to: '/leave-details',
    })
  })

  return items
}
