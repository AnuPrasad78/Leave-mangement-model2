import { useEffect, useState } from 'react'
import { TOAST_KIND } from '../../constants'
import type { EmployeeProfileRow, ToastKind } from '../../types/models'
import { fetchAllHolidays, fetchOptionalPicks } from '../../services/holidays'

/** The user's optional-holiday picks (their selections in the Holiday
 * Calendar) as a `holiday_date → holiday name` map, or null while loading.
 * Consumed by the leave request form to gate Optional-Holiday leave. */
export function usePickedOptionalHolidays(
  profile: EmployeeProfileRow | null,
  setToast: (msg: string, kind?: ToastKind) => void
): Map<string, string> | null {
  const [picked, setPicked] = useState<Map<string, string> | null>(null)

  useEffect(() => {
    const employeeId = profile?.id ?? ''
    if (!employeeId) return
    let alive = true
    void (async () => {
      try {
        const { holidayIds, error: picksError } = await fetchOptionalPicks(employeeId)
        if (picksError) {
          setToast(picksError.userMessage, TOAST_KIND.Error)
          if (alive) setPicked(new Map())
          return
        }
        const { rows, error: rowsError } = await fetchAllHolidays()
        if (rowsError) {
          setToast(rowsError.userMessage, TOAST_KIND.Error)
          if (alive) setPicked(new Map())
          return
        }
        if (!alive) return
        const idSet = new Set(holidayIds)
        const map = new Map<string, string>()
        for (const row of rows) {
          if (row.kind === 'optional' && idSet.has(row.id)) map.set(row.holiday_date, row.name)
        }
        setPicked(map)
      } catch (error) {
        if (alive) {
          setToast(error instanceof Error ? error.message : 'Unable to load your optional holidays.', TOAST_KIND.Error)
          setPicked(new Map())
        }
      }
    })()
    return () => { alive = false }
  }, [profile, setToast])

  return picked
}
