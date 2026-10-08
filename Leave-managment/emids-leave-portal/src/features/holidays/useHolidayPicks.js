import { useEffect, useMemo, useState } from 'react'
import { TOAST_KIND, MAX_PICKS } from '../../constants'
import { fetchOptionalPicks, addOptionalPick, removeOptionalPick, isPickCapError } from '../../services/holidays'
import { migrateLegacyPicks } from '../../services/legacyMigration'
import { legacyHolidayData } from '../../data/legacyHolidayData'

// Owns the optional-holiday pick list: loading, the optimistic toggle with the
// three-pick cap, and the one-time legacy localStorage migration.
export function useHolidayPicks({ profile, setToast, all, country, year }) {
  const [picks, setPicks] = useState(null) // Set of holiday ids; null while loading

  useEffect(() => {
    if (!profile?.id) return
    async function run() {
      const { holidayIds, error } = await fetchOptionalPicks(profile.id)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setPicks(new Set(holidayIds))
    }
    run()
  }, [profile, setToast])

  // One-time migration: old localStorage emids-optional-holidays stored per-cell
  // arrays of ORIGINAL-array-order indices. Resolve them to holiday ids and insert.
  // Only re-set picks when rows were actually migrated, otherwise this effect
  // re-fires on every picks update (new Set identity) and loops forever.
  useEffect(() => {
    if (!profile?.id || !all || picks === null) return
    migrateLegacyPicks({ employeeId: profile.id, all, pickedIds: [...picks], legacyData: legacyHolidayData }).then(
      ({ inserted, pickedIds }) => {
        if (inserted) setPicks(new Set(pickedIds))
      }
    )
  }, [profile, all, picks])

  const chosen = useMemo(
    () => (all ?? []).filter((h) => picks?.has(h.id) && h.country === country && h.year === Number(year) && h.kind === 'optional'),
    [all, picks, country, year]
  )

  const refetchPicks = async () => {
    if (!profile?.id) return
    const { holidayIds } = await fetchOptionalPicks(profile.id)
    setPicks(new Set(holidayIds))
  }

  const togglePick = async (h) => {
    if (!profile?.id || picks === null) return
    if (picks.has(h.id)) {
      setPicks(new Set([...picks].filter((id) => id !== h.id)))
      const { error } = await removeOptionalPick(profile.id, h.id)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        refetchPicks()
      }
      return
    }
    if (chosen.length >= MAX_PICKS) {
      setToast(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
      return
    }
    const { error } = await addOptionalPick(profile.id, h.id)
    if (error) {
      if (isPickCapError(error)) setToast(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
      else setToast(error.userMessage, TOAST_KIND.Error)
      refetchPicks()
      return
    }
    setPicks(new Set([...picks, h.id]))
  }

  return { picks, chosen, togglePick }
}
