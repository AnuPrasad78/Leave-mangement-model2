import { useMemo, useState } from 'react'
import { Button, Chip, Field, Pager, PanelTable, StatusPill } from '../../ui'
import type { PanelColumn } from '../../ui'
import { rosterPage } from '../../../features/admin/roster'
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

const BLANK: RosterFilters = { query: '', role: 'all', status: 'all', managerId: '' }
const TEAM_ANY = 'any'

export interface RosterDeskProps {
  /** The whole directory — filters and pages run over props, never the store. */
  people: EmployeeAdminRow[]
  loading?: boolean
  /** Opens the edit dialog for one person. */
  onEdit: (person: EmployeeAdminRow) => void
}

/** ORGANISM — the whole-company roster: search, filters, pager, edit actions. */
export function RosterDesk({ people, loading, onEdit }: RosterDeskProps) {
  const [filters, setFilters] = useState<RosterFilters>(BLANK)
  const [requestedPage, setRequestedPage] = useState(1)

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const teams = useMemo(
    () =>
      people
        .filter((person) => person.system_role !== 'employee' && person.is_active)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [people]
  )

  const view = useMemo(
    () => rosterPage(people, filters, requestedPage),
    [people, filters, requestedPage]
  )

  const patch = <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setRequestedPage(1)
  }

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
          <span>{byId.get(person.manager_id ?? '')?.full_name ?? 'Unassigned'}</span>
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

  const pager = (
    <Pager page={view.page} pageCount={view.pageCount} onChange={setRequestedPage} />
  )

  return (
    <>
      <div className="roster-bar card">
        <Field label="Find a person" htmlFor="roster-q">
          <input
            id="roster-q"
            className="input"
            value={filters.query}
            onChange={(event) => patch('query', event.target.value)}
            placeholder="Name, email or EM number…"
          />
        </Field>
        <div className="roster-bar__group">
          <span className="field__label">Role</span>
          <div className="roster-chips">
            {ROLE_CHIPS.map((chip) => (
              <Chip key={chip.key} isOn={filters.role === chip.key} onClick={() => patch('role', chip.key)}>
                {chip.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="roster-bar__group">
          <span className="field__label">Status</span>
          <div className="roster-chips">
            {STATUS_CHIPS.map((chip) => (
              <Chip key={chip.key} isOn={filters.status === chip.key} onClick={() => patch('status', chip.key)}>
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
            onChange={(event) => patch('managerId', event.target.value === TEAM_ANY ? '' : event.target.value)}
          >
            <option value={TEAM_ANY}>— Any reporting line —</option>
            {teams.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.full_name} · {manager.job_title ?? ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <PanelTable
        title="The roster"
        count={`${view.total} matched`}
        headExtra={<span className="muted mono">Newest joins on top</span>}
        columns={columns}
        rows={view.rows}
        rowKey={(person) => person.id}
        empty={loading ? 'Loading the roster…' : 'Nobody matches those filters. Loosen the search or chips.'}
      />
      {pager}
    </>
  )
}
