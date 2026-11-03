import { Button, Chip, Field, Pager, PanelTable, StatusPill } from '../../ui'
import type { PanelColumn } from '../../ui'
import type { RosterFilters } from '../../../features/admin/roster'
import { fmtDate } from '../../../utils/dates'
import type { EmployeeAdminRow } from '../../../types/models'

const ROLE_CHIPS: Array<{ key: RosterFilters['role']; label: string }> = [
  { key: 'all', label: 'All roles' },
  { key: 'employee', label: 'Employees' },
  { key: 'manager', label: 'Managers' },
]

const STATUS_CHIPS: Array<{ key: RosterFilters['status']; label: string }> = [
  { key: 'all', label: 'Any status' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

const TEAM_ANY = 'any'

export interface RosterDeskProps {
  /** Filter state lives on the page — every change re-queries the server. */
  filters: RosterFilters
  onFilterChange: <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => void
  /** The current server page. */
  rows: EmployeeAdminRow[]
  page: number
  pageCount: number
  total: number
  loading?: boolean
  /** Bounded manager list for the reporting-line filter. */
  managers: EmployeeAdminRow[]
  /** Opens the edit dialog for one person. */
  onEdit: (person: EmployeeAdminRow) => void
  /** Requests a different server page. */
  onPageChange: (next: number) => void
}

/** ORGANISM — the whole-company roster: search, filters, pager, edit actions.
 * Presentational: pages and filters arrive as props. */
export function RosterDesk({
  filters,
  onFilterChange,
  rows,
  page,
  pageCount,
  total,
  loading,
  managers,
  onEdit,
  onPageChange,
}: RosterDeskProps) {
  const columns: PanelColumn<EmployeeAdminRow>[] = [
    {
      label: 'Person',
      cell: (person) => (
        <div>
          <b>{person.full_name}</b>
          <div className="muted">
            {person.emp_no} · {person.email}
          </div>
        </div>
      ),
      maxWidth: 280,
    },
    {
      label: 'Role',
      width: 110,
      cell: (person) => (
        <span className={`roster-role${person.system_role !== 'employee' ? ' roster-role--mgr' : ''}`}>
          {person.system_role.toUpperCase()}
        </span>
      ),
    },
    {
      label: 'State',
      width: 110,
      cell: (person) => <StatusPill status={person.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      label: 'Reports to',
      width: 170,
      cell: (person) =>
        person.system_role !== 'employee' ? (
          <span className="muted mono">—</span>
        ) : (
          <span>{person.manager_name ?? 'Unassigned'}</span>
        ),
    },
    {
      label: 'Joined',
      width: 130,
      cell: (person) => <b>{person.doj ? fmtDate(person.doj) : '—'}</b>,
    },
    {
      label: 'Action',
      width: 130,
      cell: (person) => (
        <Button onClick={() => onEdit(person)} title={`Edit ${person.full_name}'s role, status or team`}>
          Edit
        </Button>
      ),
    },
  ]

  const pager = <Pager page={page} pageCount={pageCount} onChange={onPageChange} />

  return (
    <>
      <div className="roster-bar card">
        <Field label="Find a person" htmlFor="roster-q">
          <input
            id="roster-q"
            className="input"
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
            placeholder="Name, email or EM number…"
          />
        </Field>
        <div className="roster-bar__group">
          <span className="field__label">Role</span>
          <div className="roster-chips">
            {ROLE_CHIPS.map((chip) => (
              <Chip key={chip.key} isOn={filters.role === chip.key} onClick={() => onFilterChange('role', chip.key)}>
                {chip.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="roster-bar__group">
          <span className="field__label">Status</span>
          <div className="roster-chips">
            {STATUS_CHIPS.map((chip) => (
              <Chip key={chip.key} isOn={filters.status === chip.key} onClick={() => onFilterChange('status', chip.key)}>
                {chip.label}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Reporting line" htmlFor="roster-team">
          <select
            id="roster-team"
            className="input"
            value={filters.managerId === '' ? TEAM_ANY : filters.managerId}
            onChange={(event) => onFilterChange('managerId', event.target.value === TEAM_ANY ? '' : event.target.value)}
          >
            <option value={TEAM_ANY}>— Any reporting line —</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.full_name} · {manager.job_title ?? ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <PanelTable
        title="The roster"
        count={`${total} matched`}
        headExtra={<span className="muted mono">Newest joins on top</span>}
        columns={columns}
        rows={rows}
        rowKey={(person) => person.id}
        empty={loading ? 'Loading the roster…' : 'Nobody matches those filters. Loosen the search or chips.'}
      />
      {pager}
    </>
  )
}
