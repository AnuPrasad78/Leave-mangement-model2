import { useMemo, useState } from 'react'
import { fmtDate } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { StatusPill } from '../components/UI'

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

export default function LeaveRequests() {
  const { team, decide } = useAuth()
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('All')

  const rows = useMemo(
    () => (filter === 'All' ? team : team.filter((r) => r.status === filter)),
    [team, filter]
  )
  const pending = team.filter((r) => r.status === 'Pending').length

  const act = (id, decision) => { setBusyId(null); decide(id, decision) }
  const actWithBusy = (id, decision) => {
    setBusyId(id)
    setTimeout(() => act(id, decision), 350)
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">↘ 04 · Team Queue</span>
        <h1>Leave requests.</h1>
        <p>
          Tenure of your team, at a glance. Pending items wait in this queue until you decide
          — decisions are logged instantly.
        </p>
      </header>

      <div className="hl-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'is-on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'Pending' ? `Pending (${pending})` : f}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="hl-panel-head">
          <h3>Team Requests</h3>
          <span className="hl-count">{rows.length} ENTRIES · CENTERWELL C&P</span>
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
                <tr><td colSpan={9} className="table__empty">No {filter.toLowerCase()} requests right now.</td></tr>
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
