// Pure notification rules for the header bell.
//
// Derives the actionable items for the signed-in viewer from state the session
// already holds: pending team approvals (approvers only) and recent decisions
// on the viewer's own requests. No service calls, no store imports.
import { STATUSES } from '../../constants'
import { canApprove } from '../../utils/roles'
import { fmtDate } from '../../utils/dates'
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

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function buildNotifications(
  profile: ViewerLike | null | undefined,
  mine: LeaveRequestRow[],
  team: TeamRequestRow[]
): NotificationItem[] {
  const items: NotificationItem[] = []

  if (canApprove(profile)) {
    team.forEach((r) => {
      if (r.status !== STATUSES.Pending) return
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

  const decisions = mine
    .filter((r) => DECISION_STATUSES.includes(r.status))
    .sort((a, b) => {
      if (a.requestedOn === b.requestedOn) return a.id < b.id ? 1 : -1
      return a.requestedOn < b.requestedOn ? 1 : -1
    })
    .slice(0, MAX_DECISIONS)

  decisions.forEach((r) => {
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
