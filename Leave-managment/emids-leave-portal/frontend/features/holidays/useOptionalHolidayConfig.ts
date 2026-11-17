import { useEffect, useState } from 'react'
import { TOAST_KIND } from '../../constants'
import type { ToastKind } from '../../types/models'
import { fetchAllHolidays } from '../../services/holidays'

/** The configured optional holidays (`kind === 'optional'` rows on the shared
 * Holidays configuration) as a `holiday_date → holiday name` map, or null
 * while loading. Nothing here is pinned to the current user: exactly one
 * source of truth feeds both the Holidays page and the leave-request calendar. */
export function useOptionalHolidayConfig(
  setToast: (msg: string, kind?: ToastKind) => void
): Map<string, string> | null {
  const [configured, setConfigured] = useState<Map<string, string> | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { rows, error } = await fetchAllHolidays()
      if (!alive) return
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        setConfigured(new Map())
        return
      }
      const map = new Map<string, string>()
      for (const row of rows ?? []) {
        if (row.kind === 'optional') map.set(row.holiday_date, row.name)
      }
      setConfigured(map)
    })()
    return () => { alive = false }
  }, [setToast])

  return configured
}
