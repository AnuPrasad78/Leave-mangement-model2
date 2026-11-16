import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/AuthContext'
import { TOAST_KIND } from '@/constants'
import { PageHead } from '@/components/ui'
import LeaveRequestForm from '@/components/feature/leave-request-form/LeaveRequestForm'
import { usePickedOptionalHolidays } from '@/features/holidays/usePickedOptionalHolidays'

export default function ApplyLeave() {
  const router = useRouter()
  const { setToast, addMine, leaveTypes, balances, profile } = useAuth()
  const pickedOptionalHolidays = usePickedOptionalHolidays(profile ?? null, setToast)

  return (
    <div className="page">
      <PageHead eyebrow="New Request" title="Request time off." />
      <LeaveRequestForm
        leaveTypes={leaveTypes}
        balances={balances}
        pickedOptionalHolidays={pickedOptionalHolidays}
        addMine={addMine}
        onCancel={() => router.push('/dashboard')}
        onError={(message) => setToast(message, TOAST_KIND.Error)}
        onSubmitted={(message) => {
          setToast(message)
          router.push('/leave-details')
        }}
      />
    </div>
  )
}
