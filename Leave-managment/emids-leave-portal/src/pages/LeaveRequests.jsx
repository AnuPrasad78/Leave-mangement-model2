import { useAuth } from '../store/AuthContext'
import { PageHead } from '../components/ui'
import LeaveRequestQueue from '../components/feature/leave-request-queue/LeaveRequestQueue'

export default function LeaveRequests() {
  const { team, decide, decideMany } = useAuth()

  return (
    <div className="page">
      <PageHead eyebrow="Team Queue" title="Leave requests.">
        <p>
          Tenure of your team, at a glance. Pending items wait in this queue until you decide
          — decisions are logged instantly.
        </p>
      </PageHead>

      <LeaveRequestQueue team={team} decide={decide} decideMany={decideMany} />
    </div>
  )
}
