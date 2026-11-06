import { useAuth } from '../store/AuthContext'
import { TOAST_KIND } from '../constants'
import { PageHead } from '../components/ui'
import LeaveRequestQueue from '../components/feature/leave-request-queue/LeaveRequestQueue'

export default function LeaveRequests() {
  const { team, decide, decideMany, setToast } = useAuth()

  return (
    <div className="page">
      <PageHead eyebrow="Team Queue" title="Leave requests.">
        <p>
          Tenure of your team, at a glance. Pending items wait in this queue until you decide
          — decisions are logged instantly.
        </p>
      </PageHead>

      <LeaveRequestQueue team={team} decide={decide} decideMany={decideMany} onError={(message) => setToast(message, TOAST_KIND.Error)} />
    </div>
  )
}
