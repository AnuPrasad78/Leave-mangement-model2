import { useCallback, useState } from 'react'
import { Button, Field, PageHead, Pager } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { usePagedData } from '../hooks/usePagedData'
import { TOAST_KIND } from '../constants'
import { fetchAuditLogs } from '../services/admin'
import { AuditLogTable } from '../components/feature/admin/AuditLogTable'
import type { AuditLogRow } from '../types/models'

const ACTIONS = [
  '', 'employee_created', 'employee_updated', 'employee_deactivated', 'employee_activated',
  'password_reset_initialized', 'balance_created', 'balance_updated', 'carry_forward',
]

export default function AdminAuditLogs() {
  const { setToast } = useAuth()
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filtersApplied, setFiltersApplied] = useState(0)

  const fetcher = useCallback(
    async (page: number) => {
      const result = await fetchAuditLogs(
        {
          action: action || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        page
      )
      if (result.error) setToast(result.error.userMessage, TOAST_KIND.Error)
      return result
    },
    [action, dateFrom, dateTo, setToast]
  )
  const { rows, total, page, pageCount, setPage, loading } = usePagedData<AuditLogRow>({
    fetcher,
    // any filter change re-enters at page 1
    resetKeys: [action, dateFrom, dateTo, filtersApplied],
  })

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="Audit trail." accent>
        <p>Every admin action, append-only. Nothing here can be edited or removed.</p>
      </PageHead>

      <div className="card admin-toolbar admin-toolbar--filters">
        <Field label="Action" htmlFor="audit-action">
          <select
            id="audit-action"
            className="input"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {ACTIONS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All actions'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From" htmlFor="audit-date-from">
          <input
            id="audit-date-from"
            className="input"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </Field>
        <Field label="To" htmlFor="audit-date-to">
          <input
            id="audit-date-to"
            className="input"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </Field>
        <Button variant="ghost" onClick={() => setFiltersApplied((n) => n + 1)}>
          Re-run
        </Button>
      </div>

      <AuditLogTable
        rows={loading && !rows.length ? [] : rows}
        rowKey={(row) => row.id}
        empty={loading ? 'Loading trail…' : undefined}
      />
      <p className="admin-count">Total {total}</p>
      <Pager page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  )
}
