import { useMemo, useState } from 'react'
import { fmtDate } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { StatusPill } from '../components/UI'

const FILTERS = ['Pending', 'All', 'Approved', 'Rejected']

export default function LeaveRequests() {
  const { team, decide, decideMany } = useAuth()
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [filter, setFilter] = useState('Pending')

  const rows = useMemo(
    () => (filter === 'All' ? team : team.filter((r) => r.status === filter)),
    [team, filter]
  )
  const pendingIds = useMemo(
    () => team.filter((r) => r.status === 'Pending').map((r) => r.id),
    [team]
  )
  const pending = pendingIds.length

  const act = (id, decision) => { setBusyId(null); decide(id, decision) }
  const actWithBusy = (id, decision) => {
    setBusyId(id)
    setTimeout(() => act(id, decision), 350)
  }
  const approveAll = async () => {
    setBulkBusy(true)
    setTimeout(async () => {
      await decideMany(pendingIds, 'Approved')
      setBulkBusy(false)
    }, 350)
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Team Queue</span>
        <h1>Leave requests.</h1>
        <p>
          Tenure of your team, at a glance. Pending items wait in this queue until you decide
          — decisions are logged instantly.
        </p>
      </header>

      <div className="hl-filters">
        <label className="hl-select">
          <span className="hl-select__label">SHOWING</span>
          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter requests by status"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === 'Pending' ? `Pending (${pending})` : f}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <div className="hl-panel-head">
          <h3>Team Requests</h3>
          <div className="hl-panel-head__right">
            {pending >= 2 && (
              <button
                className="btn btn--primary btn--sm"
                disabled={bulkBusy}
                onClick={approveAll}
                title={`Approve all ${pending} pending requests`}
              >
                {bulkBusy ? 'APPROVING…' : `APPROVE ALL (${pending})`}
              </button>
            )}
            <span className="hl-count">{rows.length} ENTRIES</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th><th>Absence Type</th><th>From</th><th>To</th><th>Days</th>
                <th>Reason</th><th>Requested On</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="table__empty">No {filter === 'All' ? '' : filter.toLowerCase()} requests right now.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">
                    <div className="req-name"><b>{r.name}</b><span>{r.empId}</span></div>
                  </td>
                  <td className="nowrap">{r.absenceType}</td>
                  <td className="nowrap">{fmtDate(r.from)}</td>
                  <td className="nowrap">{fmtDate(r.to)}</td>
                  <td>{r.days}</td>
                  <td style={{ maxWidth: 240 }}>{r.reason}</td>
                  <td className="nowrap">{fmtDate(r.requestedOn)}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>
                    {r.status === 'Pending' ? (
                      <span className="row-actions">
                        <button
                          className="pill-act pill-act--approve"
                          disabled={busyId === r.id}
                          onClick={() => actWithBusy(r.id, 'Approved')}
                        >
                          APPROVE
                        </button>
                        <button
                          className="pill-act pill-act--reject"
                          disabled={busyId === r.id}
                          onClick={() => actWithBusy(r.id, 'Rejected')}
                        >
                          REJECT
                        </button>
                      </span>
                    ) : (
                      <span className="muted mono">NO ACTION</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
