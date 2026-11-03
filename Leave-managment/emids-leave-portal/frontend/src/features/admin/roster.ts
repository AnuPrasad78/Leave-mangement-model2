import type { SystemRole } from '../../types/models'

export interface RosterFilters {
  /** Name / email / employee-number fragment — sent to the server, debounced. */
  query: string
  role: 'all' | SystemRole
  status: 'all' | 'active' | 'inactive'
  /** Reporting-manager employee id; empty string = no team filter. */
  managerId: string
}
