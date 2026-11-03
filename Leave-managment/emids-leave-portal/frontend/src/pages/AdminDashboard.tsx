import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageHead } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND } from '../constants'
import { adminCarryForward, fetchAdminEmployees, fetchLeavePolicies, fetchOrgRequests, fetchStaleRequests } from '../services/admin'
import { todayISO } from '../utils/dates'
import type { LeavePolicyConfig, LeaveRequestSelectRow } from '../types/models'

type OrgPeople = { total: number; managers: number }

export default function AdminDashboard() {
  const { setToast } = useAuth()
  const [people, setPeople] = useState<OrgPeople | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [staleCount, setStaleCount] = useState<number | null>(null)
  const [policy, setPolicy] = useState<LeavePolicyConfig | null>(null)
  const [runningCarryForward, setRunningCarryForward] = useState(false)

  useEffect(() => {
    let mounted = true

    // Stale board is server-paged now — total counts past the first page too.
    fetchStaleRequests(todayISO()).then(({ page, error }) => {
      if (!mounted) return
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setStaleCount(page.total)
    })

    // Server totals are accurate from a one-row page load; no full pulls.
    fetchAdminEmployees({ pageSize: 1 }).then(({ page, error }) => {
      if (!mounted) return
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setPeople((current) => ({ total: page.total, managers: current?.managers ?? 0 }))
    })

    fetchAdminEmployees({ role: 'manager', pageSize: 1 }).then(({ page, error }) => {
      if (!mounted) return
      if (error) return
      setPeople((current) => ({ total: current?.total ?? 0, managers: page.total }))
    })

    // Aggregates read the pending subset directly (server-side status filter).
    fetchOrgRequests().then(({ rows, error }) => {
      if (!mounted) return
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setPendingCount(rows.filter((row: LeaveRequestSelectRow) => row.status === 'Pending').length)
    })

    fetchLeavePolicies().then(({ config, error }) => {
      if (!mounted) return
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setPolicy(config)
    })

    return () => {
      mounted = false
    }
  }, [setToast])

  const runCarryForward = async () => {
    if (runningCarryForward) return
    setRunningCarryForward(true)
    try {
      const year = new Date().getFullYear() - 1
      const { summary, error } = await adminCarryForward(year)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
      } else if (summary) {
        setToast(`Carry-forward for ${summary.source_year} done · ${summary.employees} employees`, TOAST_KIND.Ok)
      }
    } catch {
      setToast('The carry-forward run could not be confirmed. Check audit logs before rerunning.', TOAST_KIND.Error)
    } finally {
      setRunningCarryForward(false)
    }
  }

  const previousYear = new Date().getFullYear() - 1

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="Organization overview." accent>
        <p>People, pending work and the year-end carry-forward, at a glance.</p>
      </PageHead>

      <div className="card admin-grid">
        <div className="admin-tile">
          <b>{people ? people.total : '…'}</b>
          <span>People in the directory</span>
        </div>
        <div className="admin-tile">
          <b>{people ? people.managers : '…'}</b>
          <span>Reporting managers</span>
        </div>
        <div className="admin-tile">
          <b>{pendingCount ?? '…'}</b>
          <span>Leave requests still pending</span>
        </div>
        <div className="admin-tile">
          <b>{staleCount ?? '…'}</b>
          <span>Past-dated pending requests</span>
        </div>
      </div>

      <div className="card admin-policy">
        <h3>Credit policy (live from the backend)</h3>
        {policy ? (
          <dl className="admin-policy-list">
            <div><dt>Annual days / year</dt><dd>{policy.annual_days_per_year} (prorated by DOJ: {policy.proration_method})</dd></div>
            <div><dt>Contingency days / year</dt><dd>{policy.contingency_days_per_year}</dd></div>
            <div><dt>Carry-forward ceiling</dt><dd>{policy.carry_forward_max}</dd></div>
            <div><dt>Optional holiday picks</dt><dd>{policy.optional_holidays_max} / person / year</dd></div>
          </dl>
        ) : (
          <p>Loading policy…</p>
        )}
      </div>

      <div className="card admin-actions">
        <div>
          <h3>Pending reviews</h3>
          <p>Past-dated pending requests are reviewed against nearby approved work.</p>
          <Link className="btn btn--ghost" to="/admin/requests-stale">
            Open stale review
          </Link>
        </div>
        <div>
          <h3>Year-end carry-forward</h3>
          <p>
            Moves up to {policy ? policy.carry_forward_max : 6} unused annual days from {previousYear} into{' '}
            {previousYear + 1} opening balances. Strictly runs once per year-end.
          </p>
          <Button variant="primary" onClick={runCarryForward} busy={runningCarryForward} busyLabel="Running…">
            Run carry-forward for {previousYear}
          </Button>
        </div>
      </div>
    </div>
  )
}
