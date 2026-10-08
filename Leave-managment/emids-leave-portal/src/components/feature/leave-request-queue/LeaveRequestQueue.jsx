import { useMemo, useState } from 'react'
import { fmtDate } from '../../../utils/dates'
import { STATUSES } from '../../../constants'
import { Button, PanelTable, StatusPill } from '../../ui'

const FILTERS = [STATUSES.Pending, 'All', STATUSES.Approved, STATUSES.Rejected]

export default function LeaveRequestQueue({ team, decide, decideMany }) {
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [filter, setFilter] = useState(STATUSES.Pending)

  const rows = useMemo(
    () => (filter === 'All' ? team : team.filter((r) => r.status === filter)),
    [team, filter]
  )
  const pendingIds = useMemo(
    () => team.filter((r) => r.status === STATUSES.Pending).map((r) => r.id),
    [team]
  )
  const pending = pendingIds.length

  const act = async (id, decision) => {
    setBusyId(id)
    await decide(id, decision)
    setBusyId(null)
  }
  const approveAll = async () => {
    setBulkBusy(true)
    await decideMany(pendingIds, STATUSES.Approved)
    setBulkBusy(false)
  }

  const columns = [
    {
      label: 'Employee',
      cellClass: 'nowrap',
      cell: (r) => (
        <div className="req-name"><b>{r.name}</b><span>{r.empId}</span></div>
      ),
    },
    { label: 'Absence Type', cellClass: 'nowrap', cell: (r) => r.absenceType },
    { label: 'From', cellClass: 'nowrap', cell: (r) => fmtDate(r.from) },
    { label: 'To', cellClass: 'nowrap', cell: (r) => fmtDate(r.to) },
    { label: 'Days', cell: (r) => r.days },
    { label: 'Reason', maxWidth: 240, cell: (r) => r.reason },
    { label: 'Requested On', cellClass: 'nowrap', cell: (r) => fmtDate(r.requestedOn) },
    { label: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      label: 'Action',
      cell: (r) =>
        r.status === STATUSES.Pending ? (
          <span className="row-actions">
            <button
              className="pill-act pill-act--approve"
              disabled={busyId === r.id}
              onClick={() => act(r.id, STATUSES.Approved)}
            >
              APPROVE
            </button>
            <button
              className="pill-act pill-act--reject"
              disabled={busyId === r.id}
              onClick={() => act(r.id, STATUSES.Rejected)}
            >
              REJECT
            </button>
          </span>
        ) : (
          <span className="muted mono">NO ACTION</span>
        ),
    },
  ]

  return (
    <>
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
                {f === STATUSES.Pending ? `Pending (${pending})` : f}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PanelTable
        title="Team Requests"
        count={`${rows.length} ENTRIES`}
        headExtra={
          pending >= 2 && (
            <Button
              size="sm"
              busy={bulkBusy}
              busyLabel="APPROVING…"
              title={`Approve all ${pending} pending requests`}
              onClick={approveAll}
            >
              {`APPROVE ALL (${pending})`}
            </Button>
          )
        }
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={`No ${filter === 'All' ? '' : filter.toLowerCase()} requests right now.`}
      />
    </>
  )
}
