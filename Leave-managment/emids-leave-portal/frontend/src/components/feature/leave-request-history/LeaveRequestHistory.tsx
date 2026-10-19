import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate } from '../../../utils/dates'
import { STATUSES } from '../../../constants'
import { PanelTable, StatusPill, ConfirmModal } from '../../ui'
import type { PanelColumn } from '../../ui'
import { IconBan } from '../../Icons'
import type { LeaveRequestRow } from '../../../types/models'

// Short strip labels for the common leave types ("Leave" covers everything else)
const QUICK_LABELS: Record<string, string> = {
  'Compensatory Off': 'Comp-Off',
  'Work From Home': 'WFH',
  'Business Travel': 'Business Travel',
  'Paternity Leave': 'Paternity',
}

export interface LeaveRequestHistoryProps {
  mine: LeaveRequestRow[]
  cancelMine: (id: string) => Promise<void>
  onEdit: (request: LeaveRequestRow) => void
  yearLabel: number
}

export default function LeaveRequestHistory({ mine, cancelMine, onEdit, yearLabel }: LeaveRequestHistoryProps) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const strip = useMemo<[string, number][]>(() => {
    const byType: Record<string, number> = {}
    let rest = 0
    mine.forEach((r) => {
      if (Object.prototype.hasOwnProperty.call(QUICK_LABELS, r.type)) byType[r.type] = (byType[r.type] ?? 0) + 1
      else rest++
    })
    return [
      ['Leave', rest],
      ...Object.entries(QUICK_LABELS).map(([type, label]) => [label, byType[type] ?? 0] as [string, number]),
    ]
  }, [mine])

  const columns: PanelColumn<LeaveRequestRow>[] = [
    { label: 'Ref', cellClass: 'req-id', cell: (r) => r.id },
    { label: 'Type', cellClass: 'nowrap', cell: (r) => r.type },
    { label: 'From', cellClass: 'nowrap', cell: (r) => fmtDate(r.from) },
    { label: 'To', cellClass: 'nowrap', cell: (r) => fmtDate(r.to) },
    { label: 'Days', cellClass: 'nowrap', cell: (r) => r.days },
    { label: 'Reason', maxWidth: 260, cell: (r) => r.reason },
    { label: 'Requested', cellClass: 'nowrap', cell: (r) => fmtDate(r.requestedOn) },
    { label: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      label: 'Actions',
      cell: (r) =>
        r.status === STATUSES.Pending ? (
          <div className="row-actions">
            <button
              type="button"
              className="request-edit"
              title="Edit request"
              aria-label={`Edit request ${r.id}`}
              onClick={() => onEdit(r)}
            >
              Edit
            </button>
            <button type="button" className="icon-act" title="Cancel request" onClick={() => setConfirming(r.id)}>
              <IconBan size={15} />
            </button>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ]

  return (
    <>
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
        count={`${mine.length} ENTRIES · LV-FY${yearLabel}`}
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
    </>
  )
}
