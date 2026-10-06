import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fmtDate } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { StatusPill, ConfirmModal, Rise } from '../components/UI'

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

export default function LeaveRequests() {
  const { team, decide, decideMany } = useAuth()
  const [busyId, setBusyId] = useState(null)
  const [busyBulk, setBusyBulk] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [highlight, setHighlight] = useState(location.state?.highlight ?? null)
  // Pending-first: plain arrivals see the actionable queue only. Notification
  // deep-links force 'All' below so the targeted row is visible.
  const [filter, setFilter] = useState(() => (highlight ? 'All' : 'Pending'))
  const [selected, setSelected] = useState(() => new Set())
  const [confirmBulk, setConfirmBulk] = useState(null)

  useEffect(() => {
    if (!highlight) return
    // The targeted row must be visible: show it regardless of the active filter.
    setFilter('All')
    const t = setTimeout(() => {
      document
        .querySelector(`tr[data-req="${highlight}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlight(null), 3200)
    }, 300)
    // Clear the entry state so a refresh doesn't re-highlight.
    navigate(location.pathname, { replace: true, state: null })
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight])

  const rows = useMemo(
    () => (filter === 'All' ? team : team.filter((r) => r.status === filter)),
    [team, filter]
  )
  const pending = useMemo(() => team.filter((r) => r.status === 'Pending').length, [team])

  const visiblePending = useMemo(
    () => rows.filter((r) => r.status === 'Pending'),
    [rows]
  )
  const allVisibleSelected = visiblePending.length > 0 && visiblePending.every((r) => selected.has(r.id))
  const someVisibleSelected = visiblePending.some((r) => selected.has(r.id))

  const setFilterUI = (f) => {
    setFilter(f)
    setSelected(new Set())
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        visiblePending.forEach((r) => next.delete(r.id))
        return next
      }
      const next = new Set(prev)
      visiblePending.forEach((r) => next.add(r.id))
      return next
    })
  }

  const act = (id, decision) => {
    // a decided row can't be re-bulk-decided — remove it from the selection
    setSelected((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setBusyId(null)
    decide(id, decision)
  }
  const actWithBusy = (id, decision) => {
    setBusyId(id)
    setTimeout(() => act(id, decision), 350)
  }

  const applyBulk = async (decision) => {
    const ids = [...selected]
    if (!ids.length) return
    setBusyBulk(true)
    await decideMany(ids, decision)
    setBusyBulk(false)
    setSelected(new Set())
  }

  return (
    <div className="page">
      <Rise as="header" i={0} className="page-head">
        <span className="eyebrow">↘ 04 · Team Queue</span>
        <h1>Leave requests.</h1>
        <p>
          Tenure of your team, at a glance. Pending items wait in this queue until you decide
          — decisions are logged instantly.
        </p>
      </Rise>

      <Rise i={1} className="hl-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'is-on' : ''}`}
            onClick={() => setFilterUI(f)}
          >
            {f === 'Pending' ? `Pending (${pending})` : f}
          </button>
        ))}
      </Rise>

      <Rise i={2} className="card">
        <div className="hl-panel-head">
          <h3>Team Requests</h3>
          <span className="hl-count">{rows.length} ENTRIES · CENTERWELL C&P</span>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="bulk-bar__count mono">{selected.size} SELECTED</span>
            <div className="bulk-bar__actions">
              <button
                className="pill-act pill-act--approve bulk-pill"
                disabled={busyBulk}
                onClick={() => applyBulk('Approved')}
              >
                {busyBulk ? 'WORKING…' : 'APPROVE ALL'}
              </button>
              <button
                className="pill-act pill-act--reject bulk-pill"
                disabled={busyBulk}
                onClick={() => setConfirmBulk(selected.size)}
              >
                REJECT ALL
              </button>
              <button
                className="pill-act pill-act--clear bulk-pill"
                disabled={busyBulk}
                onClick={() => setSelected(new Set())}
              >
                CLEAR
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="chk"
                    ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                    checked={allVisibleSelected}
                    onChange={selectAllVisible}
                    aria-label="Select all pending requests"
                    disabled={visiblePending.length === 0}
                  />
                </th>
                <th>Employee</th><th>Absence Type</th><th>From</th><th>To</th><th>Days</th>
                <th>Reason</th><th>Requested On</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="table__empty">No {filter.toLowerCase()} requests right now.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} data-req={r.id} className={r.id === highlight ? 'row-highlight' : undefined}>
                  <td>
                    {r.status === 'Pending' ? (
                      <input
                        type="checkbox"
                        className="chk"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        aria-label={`Select ${r.id}`}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
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
      </Rise>

      {confirmBulk !== null && (
        <ConfirmModal
          title={`Reject ${confirmBulk} request${confirmBulk === 1 ? '' : 's'}?`}
          text="These slots return to the team's balances and the employees are notified. This cannot be undone."
          confirmLabel="Reject all"
          danger
          onConfirm={() => {
            setConfirmBulk(null)
            applyBulk('Rejected')
          }}
          onClose={() => setConfirmBulk(null)}
        />
      )}
    </div>
  )
}
