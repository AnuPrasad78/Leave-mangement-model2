import { useAuth } from '../store/AuthContext'
import { PageHead } from '../components/ui'
import LeaveRequestHistory from '../components/feature/leave-request-history/LeaveRequestHistory'

export default function LeaveDetails() {
  const { mine, cancelMine, CURRENT_YEAR } = useAuth()

  return (
    <div className="page">
      <PageHead eyebrow="My Requests" title="Leave details.">
        <p>Everything you have raised in the current leave year — newest first.</p>
      </PageHead>

      <LeaveRequestHistory mine={mine} cancelMine={cancelMine} yearLabel={CURRENT_YEAR} />
    </div>
  )
}
