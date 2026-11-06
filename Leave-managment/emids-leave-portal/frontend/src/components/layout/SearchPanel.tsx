import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDismiss } from '../../hooks/useDismiss'
import { fetchAdminEmployees } from '../../services/admin'
import type { EmployeeAdminRow, LeaveRequestRow, TeamRequestRow } from '../../types/models'

export interface SearchPanelProps {
  mine: LeaveRequestRow[]
  team: TeamRequestRow[]
  /** True only for admins: include the employee directory. */
  searchEmployees: boolean
  onDismiss: () => void
}

const MAX_PER_GROUP = 4
const MAX_EMPLOYEES = 5
const MIN_QUERY = 2

interface GroupResult {
  key: string
  label: string
  to: string
  rows: { id: string | number; title: string; meta: string }[]
}

/** Header search dropdown. Mine/team rows come straight from the store (no
 * per-keystroke fetching); admins additionally hit the server-side employee
 * directory search, debounced. Selecting a row navigates to its page. */
export default function SearchPanel({ mine, team, searchEmployees, onDismiss }: SearchPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, { onClose: onDismiss, ignoreSelector: '[data-search-toggle]' })
  const navigate = useNavigate()

  // Programmatic focus on mount — jsx-a11y forbids the autoFocus attribute,
  // but pointing the keyboard at the query box is still what a search dropdown
  // opened from the header expects.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const [query, setQuery] = useState('')
  const [employees, setEmployees] = useState<EmployeeAdminRow[]>([])
  const trimmed = query.trim().toLowerCase()
  const active = trimmed.length >= MIN_QUERY

  useEffect(() => {
    if (!searchEmployees || !active) {
      setEmployees([])
      return
    }
    let mounted = true
    const timer = setTimeout(() => {
      fetchAdminEmployees({ search: trimmed, pageSize: MAX_EMPLOYEES }).then(({ page }) => {
        if (mounted) setEmployees(page.rows)
      })
    }, 250)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [active, searchEmployees, trimmed])

  const groups = useMemo<GroupResult[]>(() => {
    if (!active) return []
    const hit = (text: string): boolean => text.toLowerCase().includes(trimmed)
    const groups: GroupResult[] = []

    const requestHit = (row: LeaveRequestRow): boolean =>
      [row.id, row.type, row.status, row.reason, row.from, row.to, String(row.requestedOn)].some(hit)
    const renderRequest = (row: LeaveRequestRow) => ({
      id: row.id,
      title: `${row.id} · ${row.type}`,
      meta: `${row.from} → ${row.to} · ${row.status}${row.reason ? ` · ${row.reason}` : ''}`,
    })

    const myRows = mine.filter(requestHit).slice(0, MAX_PER_GROUP)
    if (myRows.length > 0) {
      groups.push({ key: 'mine', label: 'My requests', to: '/leave-details', rows: myRows.map(renderRequest) })
    }

    if (searchEmployees) {
      const found = employees.map((row) => ({
        id: row.id,
        title: row.full_name,
        meta: `${row.emp_no} · ${row.system_role}${row.is_active ? '' : ' · inactive'}`,
      }))
      if (found.length > 0) {
        groups.push({ key: 'people', label: 'Employees', to: '/admin/employees', rows: found })
      }
    }

    const teamRows = team
      .filter(
        (row) =>
          requestHit(row) ||
          hit(row.name ?? '') ||
          hit(row.empId ?? '')
      )
      .slice(0, MAX_PER_GROUP)
      .map((row) => ({
        id: row.id,
        title: `${row.id} · ${row.name} — ${row.absenceType || row.type}`,
        meta: `${row.from} → ${row.to} · ${row.status}`,
      }))
    if (teamRows.length > 0) {
      groups.push({ key: 'team', label: 'Team requests', to: '/leave-requests', rows: teamRows })
    }

    return groups
  }, [active, employees, mine, searchEmployees, team, trimmed])

  const goTo = (to: string) => {
    navigate(to)
    onDismiss()
  }

  return (
    <div ref={ref} className="search-pop" role="dialog" aria-label="Search">
      <input
        ref={inputRef}
        className="search-pop__input"
        type="text"
        placeholder="Search requests, people, dates…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!active && (
        <div className="search-pop__empty">
          Type at least {MIN_QUERY} characters to search your requests…
          {searchEmployees ? ', people, ' : ' and '}
          team queue.
        </div>
      )}

      {active && groups.length === 0 && (
        <div className="search-pop__empty">No matches for “{query.trim()}”.</div>
      )}

      {groups.map((group) => (
        <div key={group.key} className="search-pop__group">
          <span className="search-pop__label">{group.label}</span>
          {group.rows.map((row) => (
            <button
              key={`${group.key}-${row.id}`}
              className="search-pop__item"
              onClick={() => goTo(group.to)}
            >
              <span className="search-pop__item-title">{row.title}</span>
              <span className="search-pop__item-meta">{row.meta}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
