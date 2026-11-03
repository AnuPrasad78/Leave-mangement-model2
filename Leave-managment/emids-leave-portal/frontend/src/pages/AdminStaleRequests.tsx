import { useEffect, useState } from 'react'
import { Button, PageHead, PanelTable } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND, STATUSES } from '../constants'
import { fetchStaleRequests } from '../services/admin'
import { decide } from '../services/leaveRequests'
import { fmtDate, dayName, todayISO } from '../utils/dates'
import type { StaleRequestRow } from '../types/models'

export default function AdminStaleRequests() {
  const { setToast } = useAuth()
  const [rows, setRows] = useState<StaleRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchStaleRequests(todayISO()).then(({ rows: fresh, error }) => {
      setLoading(false)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        setRows([])
        return
      }
      setRows(fresh)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const decideOne = async (requestNo: string, decision: 'Approved' | 'Rejected') => {
    setDeciding(requestNo)
    try {
      const { error } = await decide(requestNo, decision, 'admin-review')
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setToast(decision === STATUSES.Approved ? 'Request approved' : 'Request rejected', TOAST_KIND.Ok)
      load()
    } finally {
      setDeciding(null)
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="Stale pending review." accent>
        <p>
          Pending requests that have already passed their dates, filed with each
          colleague&apos;s nearby approved work and holidays for context.
        </p>
      </PageHead>

      <PanelTable
        title="Past-dated pending requests"
        count={String(rows.length)}
        columns={[
          { label: 'Employee', cell: (row) => <b>{row.employees?.full_name ?? '—'}</b> },
          { label: 'Type', cell: (row) => row.leave_types?.name ?? '—' },
          {
            label: 'Dates',
            cell: (row) => `${fmtDate(row.start_date)} – ${fmtDate(row.end_date)} (${dayName(row.start_date)})`,
          },
          { label: 'Days', cell: (row) => `${row.days}` },
          {
            label: 'Context',
            cell: (row) => (
              <details className="admin-evidence">
                <summary>Work context</summary>
                <ul>
                  {row.evidence.nearby_approved.map((item) => (
                    <li key={item.request_no}>
                      {item.leave_type} {fmtDate(item.start_date)}–{fmtDate(item.end_date)} ({item.status}, {item.request_no})
                    </li>
                  ))}
                  {row.evidence.nearby_approved.length === 0 && <li>No nearby approved work.</li>}
                  {row.evidence.holidays.map((item) => (
                    <li key={item.name}>{fmtDate(item.holiday_date)} · holiday: {item.name} ({item.kind})</li>
                  ))}
                </ul>
              </details>
            ),
          },
          {
            label: 'Actions',
            cell: (row) => (
              <div className="admin-row-actions">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => decideOne(row.request_no, STATUSES.Approved)}
                  busy={deciding === row.request_no}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => decideOne(row.request_no, STATUSES.Rejected)}
                  busy={deciding === row.request_no}
                >
                  Reject
                </Button>
              </div>
            ),
          },
        ]}
        rows={loading && !rows.length ? [] : rows}
        rowKey={(row) => row.request_no}
        empty={loading ? 'Loading stale requests…' : 'Nothing stale — every pending request is still future-dated.'}
      />
    </div>
  )
}
