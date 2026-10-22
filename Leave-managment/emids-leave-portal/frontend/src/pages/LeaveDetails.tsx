import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { PageHead } from '../components/ui'
import LeaveRequestHistory from '../components/feature/leave-request-history/LeaveRequestHistory'
import LeaveRequestForm from '../components/feature/leave-request-form/LeaveRequestForm'
import { TOAST_KIND } from '../constants'
import type { LeaveRequestRow } from '../types/models'

export default function LeaveDetails() {
  const { mine, cancelMine, updateMine, leaveTypes, balances, setToast, CURRENT_YEAR } = useAuth()
  const [editing, setEditing] = useState<LeaveRequestRow | null>(null)

  return (
    <div className="page">
      <PageHead eyebrow="My Requests" title="Leave details.">
        <p>Everything you have raised in the current leave year — newest first.</p>
      </PageHead>

      {editing && (
        <section className="edit-request" aria-label={`Edit request ${editing.id}`}>
          <h2 className="edit-request__title">Edit request {editing.id}</h2>
          <LeaveRequestForm
            key={editing.id}
            leaveTypes={leaveTypes}
            balances={balances}
            updateMine={updateMine}
            editRequest={editing}
            onCancel={() => setEditing(null)}
            onError={(message) => setToast(message, TOAST_KIND.Error)}
            onSubmitted={(message) => {
              setToast(message)
              setEditing(null)
            }}
          />
        </section>
      )}

      <LeaveRequestHistory mine={mine} cancelMine={cancelMine} onEdit={setEditing} yearLabel={CURRENT_YEAR} />
    </div>
  )
}
