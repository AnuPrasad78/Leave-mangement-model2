import { useCallback, useEffect, useState } from 'react'
import { PageHead } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useAdmin } from '../store/AdminContext'
import { usePagedData } from '../hooks/usePagedData'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { TOAST_KIND } from '../constants'
import { adminSetEmployeeActive, adminUpdateEmployee, fetchAdminEmployees } from '../services/admin'
import { RosterDesk } from '../components/feature/admin/RosterDesk'
import { EditPersonModal } from '../components/feature/admin/EditPersonModal'
import { editPayload } from '../features/admin/editEmployee'
import type { EditPick } from '../features/admin/editEmployee'
import type { RosterFilters } from '../features/admin/roster'
import type { EmployeeAdminRow } from '../types/models'

const BLANK: RosterFilters = { query: '', role: 'all', status: 'all', managerId: '' }

const MANAGER_CAP = 100 // page_size cap: the picker/filter reads a bounded list

export default function AdminRoster() {
  const { setToast, profile } = useAuth()
  const { reload } = useAdmin()

  const [filters, setFilters] = useState<RosterFilters>(BLANK)
  const debouncedQuery = useDebouncedValue(filters.query, 300)
  const [managers, setManagers] = useState<EmployeeAdminRow[]>([])
  const [editing, setEditing] = useState<EmployeeAdminRow | null>(null)
  const [reports, setReports] = useState<EmployeeAdminRow[] | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const fetcher = useCallback(
    async (page: number) => {
      const result = await fetchAdminEmployees({
        search: debouncedQuery || undefined,
        role: filters.role === 'all' ? undefined : filters.role,
        active: filters.status === 'all' ? undefined : filters.status === 'active',
        managerId: filters.managerId || undefined,
        sort: 'doj',
        order: 'desc',
        page,
      })
      if (result.error) setToast(result.error.userMessage, TOAST_KIND.Error)
      return result
    },
    [debouncedQuery, filters.role, filters.status, filters.managerId, setToast]
  )

  const { rows, total, page, pageCount, setPage, loading } = usePagedData<EmployeeAdminRow>({
    fetcher,
    // any filter change re-enters at page 1 (the pager sees the new board)
    resetKeys: [debouncedQuery, filters.role, filters.status, filters.managerId],
    reloadNonce,
  })

  const patch = <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // The picker + the reporting-line filter read a bounded manager list, never the page slice.
  useEffect(() => {
    let mounted = true
    fetchAdminEmployees({ role: 'manager', pageSize: MANAGER_CAP }).then(({ page: paged, error }) => {
      if (!mounted) return
      if (error) return // the board's own fetch already surfaces failures
      setManagers(paged.rows)
    })
    return () => {
      mounted = false
    }
  }, [reloadNonce])

  // Persistence lives on the page; the dialog only composes the pick.
  const apply = useCallback(
    async (pick: EditPick): Promise<string | null> => {
      if (!editing) return 'Nobody selected for this edit.'
      const profileResult = await adminUpdateEmployee(editing.id, editPayload(pick))
      const savedName = profileResult.employee?.full_name ?? editing.full_name
      if (profileResult.error) return profileResult.error.userMessage

      if (pick.is_active !== editing.is_active) {
        const statusResult = await adminSetEmployeeActive(editing.id, pick.is_active)
        if (statusResult.error) {
          return `Profile saved, but the state change failed: ${statusResult.error.userMessage}`
        }
      }

      setToast(`${savedName} updated on the roster.`, TOAST_KIND.Ok)
      reload()
      setReloadNonce((n) => n + 1)
      return null // dialog closes itself on success
    },
    [editing, reload, setToast]
  )

  // The settled-team guard needs this person's real report rows — fetch on open.
  const openEdit = useCallback((person: EmployeeAdminRow) => {
    setEditing(person)
    setReports(null)
    fetchAdminEmployees({ managerId: person.id, pageSize: MANAGER_CAP }).then(({ page: paged, error }) => {
      if (error) return
      setReports(paged.rows)
    })
  }, [])

  return (
    <div className="page">
      <PageHead eyebrow="Administration · Directory" title="Roster desk." accent>
        <p>The whole company on one ledger — every employee and manager. Retune roles, retire people or move them between teams.</p>
      </PageHead>

      <RosterDesk
        filters={filters}
        onFilterChange={patch}
        rows={rows}
        page={page}
        pageCount={pageCount}
        total={total}
        loading={loading}
        managers={managers}
        onEdit={openEdit}
        onPageChange={setPage}
      />

      {editing && reports && (
        <EditPersonModal
          person={editing}
          managers={managers}
          reports={reports}
          viewerId={profile?.id ?? null}
          onApply={apply}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
