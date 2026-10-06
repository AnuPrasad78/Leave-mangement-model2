import { useMemo, useState } from 'react'
import { fmtDate } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { StatusPill, ConfirmModal, Rise } from '../components/UI'
import { IconBan } from '../components/Icons'

export default function LeaveDetails() {
  const { mine, cancelMine } = useAuth()
  const [confirming, setConfirming] = useState(null)

  const counts = useMemo(() => {
    let leave = 0, comp = 0, wfh = 0, travel = 0, paternity = 0
    mine.forEach((r) => {
      if (r.type === 'Compensatory Off') comp++
      else if (r.type === 'Work From Home') wfh++
      else if (r.type === 'Business Travel') travel++
      else if (r.type === 'Paternity Leave') paternity++
      else leave++
    })
    return { leave, comp, wfh, travel, paternity }
  }, [mine])

  const strip = [
    ['Leave', counts.leave],
    ['Comp-Off', counts.comp],
    ['WFH', counts.wfh],
    ['Business Travel', counts.travel],
    ['Paternity', counts.paternity],
  ]

  return (
    <div className="page">
      <Rise as="header" i={0} className="page-head">
        <span className="eyebrow">↘ 03 · My Requests</span>
        <h1>Leave details.</h1>
        <p>Everything you have raised in the current leave year — newest first.</p>
      </Rise>

      <Rise as="section" i={1} className="strip" aria-label="Summary">
        {strip.map(([label, num]) => (
          <div className="strip__cell" key={label}>
            <div className="strip__num num-grad">
              {num} <small>{num === 1 ? 'REQ' : 'REQS'}</small>
            </div>
            <div className="strip__label">{label}</div>
          </div>
        ))}
      </Rise>

      <Rise i={2} className="card">
        <div className="hl-panel-head">
          <h3>Request History</h3>
          <span className="hl-count">{mine.length} ENTRIES · LV-FY2026</span>
        </div>
        {mine.length === 0 ? (
          <div className="table__empty">No requests on file. (<a href="/apply-leave">Raise one</a> ↗)</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th>
                <th>Requested</th><th>Status</th><th>Cancel</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((r) => (
                <tr key={r.id}>
                  <td className="req-id">{r.id}</td>
                  <td className="nowrap">{r.type}</td>
                  <td className="nowrap">{fmtDate(r.from)}</td>
                  <td className="nowrap">{fmtDate(r.to)}</td>
                  <td className="nowrap">{r.days}</td>
                  <td style={{ maxWidth: 260 }}>{r.reason}</td>
                  <td className="nowrap">{fmtDate(r.requestedOn)}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>
                    {r.status === 'Pending' ? (
                      <button className="icon-act" title="Cancel request" onClick={() => setConfirming(r.id)}>
                        <IconBan size={15} />
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Rise>

      {confirming && (
        <ConfirmModal
          title="Cancel this request?"
          text="The slot goes back to your balance immediately and the approver is notified. This cannot be undone."
          confirmLabel="Cancel request"
          danger
          onConfirm={() => { cancelMine(confirming); setConfirming(null) }}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
