'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../store/AuthContext'
import { TOAST_KIND } from '../../../../constants/index'
import { PageHead } from '../../../components/index'
import LeaveRequestForm from '../../../components/organisms/LeaveRequestForm/LeaveRequestForm'
import { usePickedOptionalHolidays } from '../../../../hooks/usePickedOptionalHolidays'

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
