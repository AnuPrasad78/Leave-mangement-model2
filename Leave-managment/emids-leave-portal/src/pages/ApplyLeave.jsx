import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { PageHead } from '../components/ui'
import LeaveRequestForm from '../components/feature/leave-request-form/LeaveRequestForm'

export default function ApplyLeave() {
  const navigate = useNavigate()
  const { setToast, addMine, leaveTypes, balances } = useAuth()

  return (
    <div className="page">
      <PageHead eyebrow="New Request" title="Request time off." />
      <LeaveRequestForm
        leaveTypes={leaveTypes}
        balances={balances}
        addMine={addMine}
        onCancel={() => navigate('/dashboard')}
        onSubmitted={(message) => {
          setToast(message)
          navigate('/leave-details')
        }}
      />
    </div>
  )
}
