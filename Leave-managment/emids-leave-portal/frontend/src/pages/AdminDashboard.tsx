import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageHead } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND } from '../constants'
import { adminCarryForward, fetchStaleRequests } from '../services/admin'
import { todayISO } from '../utils/dates'

export default function AdminDashboard() {
  const { setToast } = useAuth()
  const [staleCount, setStaleCount] = useState<number | null>(null)
  const [runningCarryForward, setRunningCarryForward] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchStaleRequests(todayISO()).then(({ rows, error }) => {
      if (!mounted) return
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setStaleCount(rows.length)
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

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="Organization overview." accent>
        <p>People, pending work and the year-end carry-forward, at a glance.</p>
      </PageHead>

      <div className="card admin-grid">
        <div className="admin-tile">
          <b>{staleCount ?? '…'}</b>
          <span>Past-dated pending requests</span>
        </div>
        <div className="admin-tile">
          <b>22</b>
          <span>Annual days / year (prorated by DOJ)</span>
        </div>
        <div className="admin-tile">
          <b>10</b>
          <span>Contingency days / year</span>
        </div>
        <div className="admin-tile">
          <b>6</b>
          <span>Carry-forward ceiling</span>
        </div>
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
            Moves up to 6 unused annual days from {new Date().getFullYear() - 1} into{' '}
            {new Date().getFullYear()} opening balances. Strictly runs once per year-end.
          </p>
          <Button variant="primary" onClick={runCarryForward} busy={runningCarryForward} busyLabel="Running…">
            Run carry-forward for {new Date().getFullYear() - 1}
          </Button>
        </div>
      </div>
    </div>
  )
}
