import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Chip, Field, PageHead, PanelTable, Pager } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { usePagedData } from '../hooks/usePagedData'
import { TOAST_KIND } from '../constants'
import {
  adminSendNudge,
  fetchAdminEmployees,
  fetchOrgRequests,
  fetchPendingRequestsPage,
} from '../services/admin'
import { fmtDate } from '../utils/dates'
import type { EmployeeAdminRow, LeaveRequestSelectRow } from '../types/models'

interface ManagerQueueRow {
  manager: EmployeeAdminRow
  pending: number
  oldest_requested_on: string | null
}

const REMINDER_PEOPLE_CAP = 100 // page_size cap for the manager-resolution read

export default function AdminReminders() {
  const { setToast } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LeaveRequestSelectRow[]>([])
  const [people, setPeople] = useState<EmployeeAdminRow[]>([])
  const [picks, setPicks] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)

  const boardFetcher = useCallback((page: number) => fetchPendingRequestsPage(page), [])
  const board = usePagedData<LeaveRequestSelectRow>({ fetcher: boardFetcher })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([fetchOrgRequests(), fetchAdminEmployees({ pageSize: REMINDER_PEOPLE_CAP })]).then(
      ([requestsResult, peopleResult]) => {
        if (!mounted) return
        if (requestsResult.error) setToast(requestsResult.error.userMessage, TOAST_KIND.Error)
        if (peopleResult.error) setToast(peopleResult.error.userMessage, TOAST_KIND.Error)
        setRows(requestsResult.rows)
        setPeople(peopleResult.page.rows)
        setLoading(false)
      }
    )
    return () => {
      mounted = false
    }
  }, [setToast])

  // The aggregate read is pending-only now (server-side status filter).
  const pending = useMemo(() => rows.filter((row) => row.status === 'Pending'), [rows])

  const queue = useMemo<ManagerQueueRow[]>(() => {
    const byManager = new Map<string, LeaveRequestSelectRow[]>()
    const managerOf = new Map(people.map((person) => [person.id, person.manager_id]))
    for (const row of pending) {
      const managerId = managerOf.get(row.employee_id)
      if (!managerId) continue
      const bucket = byManager.get(managerId) ?? []
      bucket.push(row)
      byManager.set(managerId, bucket)
    }
    const managerById = new Map(people.map((person) => [person.id, person]))
    return [...byManager.entries()]
      .filter(([managerId]) => managerById.get(managerId)?.is_active !== false)
      .map(([managerId, holding]) => ({
        manager: managerById.get(managerId)!,
        pending: holding.length,
        oldest_requested_on: holding.reduce(
          (oldest, row) => (oldest && oldest < row.requested_on ? oldest : row.requested_on),
          holding[0]?.requested_on ?? null
        ),
      }))
      .sort((a, b) => b.pending - a.pending)
  }, [pending, people])

  useEffect(() => {
    if (queue.length > 0 && !subject) refillCopy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  const togglePick = (id: string) => {
    setPicks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const refillCopy = () => {
    const picked = queue.filter((entry) => picks.has(entry.manager.id))
    const target = picked.length > 0 ? picked : queue
    const holdings = target.reduce((sum, entry) => sum + entry.pending, 0)
    setSubject(`${holdings} pending leave decisions waiting`)
    setMessage(
      target
        .map(
          (entry) =>
            `* ${entry.manager.full_name}: ${entry.pending} pending (oldest filed ${entry.oldest_requested_on ? fmtDate(entry.oldest_requested_on) : 'recently'})`
        )
        .join('\n')
    )
  }

  useEffect(() => {
    if (queue.length > 0 && !subject) refillCopy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  const send = async () => {
    const picked = queue.filter((entry) => picks.has(entry.manager.id))
    if (picked.length === 0) {
      setToast('Pick at least one manager to nudge.', TOAST_KIND.Error)
      return
    }
    if (!subject.trim() || !message.trim()) {
      setToast('Subject and message are both needed.', TOAST_KIND.Error)
      return
    }
    setSending(true)
    try {
      const { error } = await adminSendNudge({
        recipient_employee_ids: picked.map((entry) => entry.manager.id),
        title: subject.trim(),
        body: message.trim(),
      })
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setToast(`Nudge sent to ${picked.length === 1 ? picked[0].manager.full_name : `${picked.length} managers`}`, TOAST_KIND.Ok)
      setSentCount((n) => n + 1)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Administration · Manager reminders" title="Nudge the queueholders." accent>
        <p>See who is sitting on pending time-off decisions and send an in-app nudge without leaving the desk.</p>
      </PageHead>

      <PanelTable
        title="Pending queue by manager"
        count={`${queue.length} managers`}
        columns={[
          {
            label: 'Manager',
            cell: (entry) => (
              <div>
                <b>{entry.manager.full_name}</b> <span className="muted">{entry.manager.emp_no}</span>
              </div>
            ),
          },
          { label: 'Pending', cell: (entry) => <span className="mono">{entry.pending}</span> },
          {
            label: 'Oldest',
            cell: (entry) =>
              entry.oldest_requested_on ? (
                <>filed {fmtDate(entry.oldest_requested_on)}</>
              ) : (
                '—'
              ),
          },
          {
            label: 'Hold',
            cell: (entry) => (
              <Chip isOn={picks.has(entry.manager.id)} onClick={() => togglePick(entry.manager.id)}>
                Nudge
              </Chip>
            ),
          },
        ]}
        rows={loading ? [] : queue}
        rowKey={(entry) => entry.manager.id}
        empty={loading ? 'Loading pending queues…' : 'All clear — no pending requests are waiting on any manager.'}
      />

      <div className="card admin-nudge">
        <div className="hl-panel-head">
          <h3>Nudge composer</h3>
          <Button variant="ghost" size="sm" onClick={refillCopy}>
            Rebuild copy
          </Button>
        </div>
        <Field label="Subject" htmlFor="nudge-subject">
          <input
            id="nudge-subject"
            className="input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>
        <Field label="Message" htmlFor="nudge-message">
          <textarea
            id="nudge-message"
            className="input"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
        <div className="admin-editor__actions">
          <Button variant="primary" onClick={send} busy={sending} busyLabel="Sending…">
            Send nudge
          </Button>
        </div>
        {sentCount > 0 && (
          <p className="muted">
            {sentCount} nudge{sentCount > 1 ? 's' : ''} sent this session · recipients also see it in their notification bell. Every send is recorded in the audit trail.
          </p>
        )}
      </div>

      <PanelTable
        title="Every pending request in the system"
        count={`${board.total} waiting`}
        columns={[
          { label: 'Request', cell: (row) => <span className="mono">{row.request_no}</span> },
          { label: 'Person', cell: (row) => row.employees?.full_name ?? '—' },
          { label: 'Type', cell: (row) => row.leave_types?.name ?? '—' },
          { label: 'From', cell: (row) => fmtDate(row.start_date) },
          { label: 'Days', cell: (row) => `${row.days}` },
        ]}
        rows={board.loading ? [] : board.rows}
        rowKey={(row) => row.request_no}
        empty={board.loading ? 'Loading requests…' : 'No pending requests.'}
      />
      <Pager page={board.page} pageCount={board.pageCount} onChange={board.setPage} />
    </div>
  )
}
