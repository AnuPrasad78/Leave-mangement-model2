import { useMemo, useState } from 'react'
import { fmtDate } from '../../../utils/dates'
import { STATUSES } from '../../../constants'
import { Button, PanelTable, StatusPill } from '../../ui'
import type { PanelColumn } from '../../ui'
import type { RequestDecision, RequestStatus, TeamRequestRow } from '../../../types/models'

const FILTERS: (RequestStatus | 'All')[] = [STATUSES.Pending, 'All', STATUSES.Approved, STATUSES.Rejected]

export interface LeaveRequestQueueProps {
  team: TeamRequestRow[]
  decide: (id: string, decision: RequestDecision) => Promise<void>
  decideMany: (ids: string[], decision: RequestDecision) => Promise<void>
  onError: (message: string) => void
}

export default function LeaveRequestQueue({ team, decide, decideMany, onError }: LeaveRequestQueueProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [filter, setFilter] = useState<RequestStatus | 'All'>(STATUSES.Pending)

  const rows = useMemo(
    () => (filter === 'All' ? team : team.filter((r) => r.status === filter)),
    [team, filter]
  )
  const pendingIds = useMemo(
    () => team.filter((r) => r.status === STATUSES.Pending).map((r) => r.id),
    [team]
  )
  const pending = pendingIds.length

  const act = async (id: string, decision: RequestDecision) => {
    setBusyId(id)
    try {
      await decide(id, decision)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The decision outcome could not be confirmed. Refresh the queue before trying again.')
    } finally {
      setBusyId(null)
    }
  }
  const approveAll = async () => {
    setBulkBusy(true)
    try {
      await decideMany(pendingIds, STATUSES.Approved)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The bulk decision outcome could not be confirmed. Refresh the queue before trying again.')
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: PanelColumn<TeamRequestRow>[] = [
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
          {/* select only offers FILTERS values, so the cast to the union is safe */}
          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as RequestStatus | 'All')}
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
