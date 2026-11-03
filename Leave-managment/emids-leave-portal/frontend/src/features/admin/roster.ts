import { paginate } from '../../utils/paginate'
import type { EmployeeAdminRow } from '../../types/models'

export const ROSTER_PAGE_SIZE = 10

export interface RosterFilters {
  /** Name / email / employee-number fragment — case-insensitive. */
  query: string
  role: 'all' | 'employee' | 'manager' | 'admin'
  status: 'all' | 'active' | 'inactive'
  /** Reporting-manager employee id; empty string = no team filter. */
  managerId: string
}

/**
 * The whole directory filtered + ordered for the roster: newest joins first
 * (the admin usually wants the fresh faces), same-day ties alphabetical.
 */
export function matchRoster(people: EmployeeAdminRow[], filters: RosterFilters): EmployeeAdminRow[] {
  const query = filters.query.trim().toLowerCase()
  const picked = people.filter((person) => {
    if (filters.role !== 'all' && person.system_role !== filters.role) return false
    if (filters.status !== 'all' && (filters.status === 'active') !== person.is_active) return false
    if (filters.managerId && person.manager_id !== filters.managerId) return false
    if (
      query &&
      !person.full_name.toLowerCase().includes(query) &&
      !person.email.toLowerCase().includes(query) &&
      !person.emp_no.toLowerCase().includes(query)
    ) {
      return false
    }
    return true
  })
  return picked.sort(
    (a, b) =>
      (b.doj ?? '').localeCompare(a.doj ?? '') ||
      a.full_name.localeCompare(b.full_name)
  )
}

export interface RosterView {
  rows: EmployeeAdminRow[]
  page: number
  pageCount: number
  total: number
}

/** One page slice; `page` is clamped into the surviving range. */
export function rosterPage(
  people: EmployeeAdminRow[],
  filters: RosterFilters,
  page: number
): RosterView {
  const rows = matchRoster(people, filters)
  const view = paginate(rows, page, ROSTER_PAGE_SIZE)
  return { rows: view.rows, page: view.page, pageCount: view.pageCount, total: view.total }
}
