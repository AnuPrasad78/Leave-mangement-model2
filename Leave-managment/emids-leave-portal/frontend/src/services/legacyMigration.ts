import { supabase } from '../lib/supabase'
import { MAX_PICKS } from '../constants'
import { fetchOptionalPicks } from './holidays'
import { normalizeSupabaseError, withServiceErrors } from './errors'
import type { HolidaysRow, OptionalHolidayPickInsert, ServicedError } from '../types/models'
import type { LegacyHolidayData } from '../data/legacyHolidayData'

export const LEGACY_STORAGE_KEY = 'emids-optional-holidays'

// One-time migration: the old localStorage emids-optional-holidays stored per-cell
// arrays of ORIGINAL-array-order indices. Resolves them to holiday ids and inserts.
export async function migrateLegacyPicks({ employeeId, all, pickedIds, legacyData, storage = window.localStorage }: {
  employeeId: string
  all: HolidaysRow[]
  pickedIds: number[]
  legacyData: LegacyHolidayData
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
}): Promise<{ inserted: OptionalHolidayPickInsert[] | null; pickedIds: number[]; error: ServicedError | null }> {
  let raw: string | null
  try {
    raw = storage.getItem(LEGACY_STORAGE_KEY)
  } catch (error) {
    return { inserted: null, pickedIds, error: { code: 'storage', context: 'legacy pick migration', userMessage: error instanceof Error ? error.message : 'Unable to read saved holiday picks.' } }
  }
  if (!raw) return { inserted: null, pickedIds, error: null }

  let mapping: Record<string, unknown>
  try {
    mapping = JSON.parse(raw) || {}
  } catch {
    return { inserted: null, pickedIds, error: { code: 'invalid_storage', context: 'legacy pick migration', userMessage: 'Saved holiday picks could not be read. They were kept so they can be recovered.' } }
  }
  if (!Object.keys(mapping).length) {
    try {
      storage.removeItem(LEGACY_STORAGE_KEY)
      return { inserted: null, pickedIds, error: null }
    } catch (error) {
      return { inserted: null, pickedIds, error: { code: 'storage', context: 'legacy pick migration', userMessage: error instanceof Error ? error.message : 'Saved holiday picks could not be cleared.' } }
    }
  }

  const meta = new Map<number, HolidaysRow>(all.map((h) => [h.id, h] as const))
  const perCell: Record<string, number> = {}
  pickedIds.forEach((id) => {
    const m = meta.get(id)
    if (m) {
      const k = `${m.country}|${m.year}`
      perCell[k] = (perCell[k] ?? 0) + 1
    }
  })

  const seen = new Set<number>()
  const existing = new Set(pickedIds)
  const toInsert: OptionalHolidayPickInsert[] = []
  Object.entries(mapping).forEach(([cellKey, idxs]) => {
    const [cn, yr] = cellKey.split('|')
    const list = legacyData[cn]?.optional?.[Number(yr)] ?? []
    const budget = MAX_PICKS - (perCell[`${cn}|${Number(yr)}`] ?? 0)
    let used = 0
    ;(Array.isArray(idxs) ? idxs : []).forEach((i) => {
      if (used >= budget) return
      const h = list[Number(i)]
      if (!h) return
      const row = all.find(
        (x) => x.country === cn && x.year === Number(yr) && x.kind === 'optional' && x.holiday_date === h.date && x.name === h.name
      )
      if (row && !seen.has(row.id) && !existing.has(row.id)) {
        seen.add(row.id)
        toInsert.push({ employee_id: employeeId, holiday_id: row.id })
        used++
      }
    })
  })

  if (toInsert.length) {
    const write = await withServiceErrors(
      'legacy pick migration',
      async () => {
        const { error } = await supabase.from('optional_holiday_picks').insert(toInsert)
        return { error: normalizeSupabaseError(error, 'legacy pick migration') }
      },
      (error) => ({ error }),
      false,
      true
    )
    const refresh = await fetchOptionalPicks(employeeId)
    const refreshed = new Set(refresh.holidayIds)
    const complete = toInsert.every((pick) => refreshed.has(pick.holiday_id))
    if (write.error && (!write.error.outcomeUnknown || !complete)) {
      return { inserted: null, pickedIds: refresh.holidayIds, error: write.error }
    }
    if (refresh.error && !write.error) {
      return {
        inserted: toInsert,
        pickedIds: [...new Set([...pickedIds, ...toInsert.map((pick) => pick.holiday_id)])],
        error: refresh.error,
      }
    }
    if (refresh.error && write.error) {
      return { inserted: null, pickedIds, error: write.error }
    }
    try {
      storage.removeItem(LEGACY_STORAGE_KEY)
    } catch (error) {
      return {
        inserted: toInsert,
        pickedIds: refresh.holidayIds,
        error: { code: 'storage', context: 'legacy pick migration', userMessage: error instanceof Error ? error.message : 'Holiday picks were imported, but saved legacy data could not be cleared.' },
      }
    }
    return { inserted: toInsert, pickedIds: refresh.holidayIds, error: null }
  }
  try {
    storage.removeItem(LEGACY_STORAGE_KEY)
    return { inserted: null, pickedIds, error: null }
  } catch (error) {
    return { inserted: null, pickedIds, error: { code: 'storage', context: 'legacy pick migration', userMessage: error instanceof Error ? error.message : 'Saved holiday picks could not be cleared.' } }
  }
}
