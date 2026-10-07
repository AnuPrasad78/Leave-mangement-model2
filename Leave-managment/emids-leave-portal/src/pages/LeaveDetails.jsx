import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate } from '../utils/dates'
import { useAuth } from '../store/AuthContext'
import { STATUSES } from '../constants'
import { PageHead, PanelTable, StatusPill, ConfirmModal } from '../components/ui'
import { IconBan } from '../components/Icons'

// Short strip labels for the common leave types ("Leave" covers everything else)
const QUICK_LABELS = {
  'Compensatory Off': 'Comp-Off',
  'Work From Home': 'WFH',
  'Business Travel': 'Business Travel',
  'Paternity Leave': 'Paternity',
}

export default function LeaveDetails() {
  const { mine, cancelMine, CURRENT_YEAR } = useAuth()
  const [confirming, setConfirming] = useState(null)

  const strip = useMemo(() => {
    const byType = {}
    let rest = 0
    mine.forEach((r) => {
      if (Object.prototype.hasOwnProperty.call(QUICK_LABELS, r.type)) byType[r.type] = (byType[r.type] ?? 0) + 1
      else rest++
    })
    return [
      ['Leave', rest],
      ...Object.entries(QUICK_LABELS).map(([type, label]) => [label, byType[type] ?? 0]),
    ]
  }, [mine])

  const columns = [
    { label: 'Ref', cellClass: 'req-id', cell: (r) => r.id },
    { label: 'Type', cellClass: 'nowrap', cell: (r) => r.type },
    { label: 'From', cellClass: 'nowrap', cell: (r) => fmtDate(r.from) },
    { label: 'To', cellClass: 'nowrap', cell: (r) => fmtDate(r.to) },
    { label: 'Days', cellClass: 'nowrap', cell: (r) => r.days },
    { label: 'Reason', maxWidth: 260, cell: (r) => r.reason },
    { label: 'Requested', cellClass: 'nowrap', cell: (r) => fmtDate(r.requestedOn) },
    { label: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      label: 'Cancel',
      cell: (r) =>
        r.status === STATUSES.Pending ? (
          <button className="icon-act" title="Cancel request" onClick={() => setConfirming(r.id)}>
            <IconBan size={15} />
          </button>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ]

  return (
    <div className="page">
      <PageHead eyebrow="My Requests" title="Leave details.">
        <p>Everything you have raised in the current leave year — newest first.</p>
      </PageHead>

      <section className="strip" aria-label="Summary">
        {strip.map(([label, num]) => (
          <div className="strip__cell" key={label}>
            <div className="strip__num">
              {num} <small>{num === 1 ? 'REQ' : 'REQS'}</small>
            </div>
            <div className="strip__label">{label}</div>
          </div>
        ))}
      </section>

      <PanelTable
        title="Request History"
        count={`${mine.length} ENTRIES · LV-FY${CURRENT_YEAR}`}
        columns={columns}
        rows={mine}
        rowKey={(r) => r.id}
        emptyBlock={
          <div className="table__empty">
            No requests on file. (<Link to="/apply-leave">Raise one</Link>)
          </div>
        }
      />

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
