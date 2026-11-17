import { useEffect, useMemo, useRef, useState } from 'react'
import { TOAST_KIND, MAX_PICKS } from '../../constants'
import type { EmployeeProfileRow, HolidaysRow, ToastKind } from '../../types/models'
import { fetchOptionalPicks, addOptionalPick, removeOptionalPick, isPickCapError } from '../../services/holidays'
import { migrateLegacyPicks } from '../../services/legacyMigration'
import { legacyHolidayData } from '../../data/legacyHolidayData'

// Owns the optional-holiday pick list: loading, the optimistic toggle with the
// three-pick cap, and the one-time legacy localStorage migration.
export function useHolidayPicks({ profile, setToast, all, country, year }: {
  profile: EmployeeProfileRow | null
  setToast: (msg: string, kind?: ToastKind) => void
  all: HolidaysRow[] | null
  country: string
  year: number
}): {
  picks: Set<number> | null
  chosen: HolidaysRow[]
  togglePick: (h: HolidaysRow) => Promise<void>
} {
  const [picks, setPicks] = useState<Set<number> | null>(null) // Set of holiday ids; null while loading
  const migrationAttempts = useRef(new Set<string>())
  const unresolved = useRef(new Set<number>())

  useEffect(() => {
    // `?? ''` keeps the id a `string` for the async closure below (an optional
    // chain can't be narrowed inside `run()`); '' is falsy like the old guard.
    const employeeId = profile?.id ?? ''
    if (!employeeId) return
    let active = true
    async function run() {
      try {
        const { holidayIds, error } = await fetchOptionalPicks(employeeId)
        if (!active) return
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        setPicks(new Set(holidayIds))
      } catch (error) {
        if (active) setToast(error instanceof Error ? error.message : 'Unable to load optional holiday picks.', TOAST_KIND.Error)
      }
    }
    void run()
    return () => { active = false }
  }, [profile, setToast])

  // One-time migration: old localStorage emids-optional-holidays stored per-cell
  // arrays of ORIGINAL-array-order indices. Resolve them to holiday ids and insert.
  // Only re-set picks when rows were actually migrated, otherwise this effect
  // re-fires on every picks update (new Set identity) and loops forever.
  useEffect(() => {
    const employeeId = profile?.id
    if (!employeeId || !all || picks === null) return
    if (migrationAttempts.current.has(employeeId)) return
    migrationAttempts.current.add(employeeId)
    let active = true
    void migrateLegacyPicks({ employeeId, all, pickedIds: [...picks], legacyData: legacyHolidayData }).then(
      ({ inserted, pickedIds, error }) => {
        if (!active) return
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        if (inserted) setPicks(new Set(pickedIds))
      },
    ).catch((error: unknown) => {
      if (active) setToast(error instanceof Error ? error.message : 'Unable to migrate saved holiday picks.', TOAST_KIND.Error)
    })
    return () => { active = false }
  }, [profile, all, picks, setToast])

  const chosen = useMemo<HolidaysRow[]>(
    () => (all ?? []).filter((h) => picks?.has(h.id) && h.country === country && h.year === Number(year) && h.kind === 'optional'),
    [all, picks, country, year]
  )

  const refetchPicks = async () => {
    const employeeId = profile?.id
    if (!employeeId) return false
    try {
      const { holidayIds, error } = await fetchOptionalPicks(employeeId)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return false
      }
      setPicks(new Set(holidayIds))
      unresolved.current.clear()
      return true
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to refresh optional holiday picks.', TOAST_KIND.Error)
      return false
    }
  }

  const togglePick = async (h: HolidaysRow) => {
    const employeeId = profile?.id
    if (!employeeId || picks === null) return
    if (unresolved.current.has(h.id)) {
      await refetchPicks()
      return
    }
    if (picks.has(h.id)) {
      setPicks(new Set([...picks].filter((id) => id !== h.id)))
      try {
        const { error } = await removeOptionalPick(employeeId, h.id)
        if (error) {
          if (error.outcomeUnknown) unresolved.current.add(h.id)
          setToast(error.userMessage, TOAST_KIND.Error)
          await refetchPicks()
        }
      } catch (error) {
        unresolved.current.add(h.id)
        setToast(error instanceof Error ? error.message : 'The pick removal outcome could not be confirmed. Refresh the calendar before trying again.', TOAST_KIND.Error)
        await refetchPicks()
      }
      return
    }
    if (chosen.length >= MAX_PICKS) {
      setToast(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
      return
    }
    try {
      const { error } = await addOptionalPick(employeeId, h.id)
      if (error) {
        if (error.outcomeUnknown) unresolved.current.add(h.id)
        if (isPickCapError(error)) setToast(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
        else setToast(error.userMessage, TOAST_KIND.Error)
        await refetchPicks()
        return
      }
      setPicks(new Set([...picks, h.id]))
    } catch (error) {
      unresolved.current.add(h.id)
      setToast(error instanceof Error ? error.message : 'The pick outcome could not be confirmed. Refresh the calendar before trying again.', TOAST_KIND.Error)
      await refetchPicks()
    }
  }

  return { picks, chosen, togglePick }
}
