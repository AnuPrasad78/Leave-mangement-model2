import { useEffect, useState } from 'react'
import { TOAST_KIND } from '../../constants'
import type { ToastKind } from '../../types/models'
import { fetchMyLeavePolicy } from '../../services/leavePolicy'

/** The optional-holiday leave allowance (holidays per year) straight from the
 * backend policy constants, or null while loading/unavailable. Read by the
 * leave-request form so the displayed cap and every limit change to policy
 * come from one source of truth. */
export function useOptionalHolidayAllowance(
  setToast: (msg: string, kind?: ToastKind) => void
): number | null {
  const [allowance, setAllowance] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { row, error } = await fetchMyLeavePolicy()
      console.log('useOptionalHolidayAllowance: fetchMyLeavePolicy', { row, error })
      if (!alive) return
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        setAllowance(null)
        return
      }
      setAllowance(typeof row?.optional_holidays_max === 'number' ? row.optional_holidays_max : null)
    })()
    return () => { alive = false }
  }, [setToast])

  return allowance
}
