// Pure global-search rules for the header search overlay.
//
// Build an index from the data the session already holds (nav routes, the
// signer's own requests, and — for approvers — the team queue), then filter it
// against a query. No service calls, no routing imports: pages keep ownership.
import { canApprove } from '../../utils/roles'
import { fmtDate } from '../../utils/dates'
import type { EmployeeProfileRow, LeaveRequestRow, TeamRequestRow } from '../../types/models'

export type SearchSection = 'Pages' | 'My requests' | 'Team requests'

export interface SearchHit {
  key: string
  section: SearchSection
  title: string
  meta: string
  to: string
}

export interface SearchIndexEntry extends SearchHit {
  /** lowercased blob the filter matches against — internal, not rendered */
  search: string
}

/** Searchable nav surface, kept identical to the drawer's role-filtered links. */
export interface SearchNavEntry {
  to: string
  label: string
  tagline?: string
}

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

const requestBlob = (parts: (string | undefined | null)[]): string =>
  normalize(parts.filter((p): p is string => !!p).join(' '))

function compactRange(from: string, to: string): string {
  return `${fmtDate(from)}–${fmtDate(to)}`
}

export function buildSearchIndex(
  nav: SearchNavEntry[],
  role: EmployeeProfileRow['system_role'] | null | undefined,
  mine: LeaveRequestRow[],
  team: TeamRequestRow[]
): SearchIndexEntry[] {
  const index: SearchIndexEntry[] = []

  nav.forEach((n) => {
    index.push({
      key: `page:${n.to}`,
      section: 'Pages',
      title: n.label,
      meta: n.tagline ?? '',
      to: n.to,
      search: normalize(`${n.label} ${n.tagline ?? ''} ${n.to}`),
    })
  })

  mine.forEach((r) => {
    index.push({
      key: `mine:${r.id}`,
      section: 'My requests',
      title: `${r.id} · ${r.type}`,
      meta: `${compactRange(r.from, r.to)} · ${r.status}${r.reason ? ` · ${r.reason}` : ''}`,
      to: '/leave-details',
      search: requestBlob([r.id, r.type, r.reason, r.status, r.from, r.to, r.requestedOn]),
    })
  })

  // Team hits only exist where the queue itself exists — the overlay mirrors
  // the ManagerOnly route guard so employees never see dead links.
  const approver = canApprove({ system_role: role })
  if (approver) {
    team.forEach((r) => {
      index.push({
        key: `team:${r.id}`,
        section: 'Team requests',
        title: `${r.name} · ${r.absenceType}`,
        meta: `${r.empId} · ${compactRange(r.from, r.to)} · ${r.status}`,
        to: '/leave-requests',
        search: requestBlob([r.id, r.name, r.empId, r.absenceType, r.reason, r.status, r.from, r.to, r.requestedOn]),
      })
    })
  }

  return index
}

/**
 * Empty/whitespace query → no results (the overlay shows its idle hint).
 * Every whitespace-separated token must appear somewhere in the hit's blob
 * (plain substring match — query text is never used as a RegExp, so special
 * characters are inherently safe). Results are capped to keep the overlay nimble.
 */
export const MAX_HITS = 15

export function filterHits(index: SearchIndexEntry[], query: string): SearchHit[] {
  const q = normalize(query)
  if (!q) return []
  const tokens = q.split(' ').filter(Boolean)
  if (!tokens.length) return []
  return index
    .filter((e) => tokens.every((t) => e.search.includes(t)))
    .slice(0, MAX_HITS)
    .map(({ search: _search, ...hit }) => hit)
}
