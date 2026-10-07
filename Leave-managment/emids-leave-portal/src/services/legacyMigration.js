import { supabase } from '../lib/supabase'
import { MAX_PICKS } from '../constants'

export const LEGACY_STORAGE_KEY = 'emids-optional-holidays'

// One-time migration: the old localStorage emids-optional-holidays stored per-cell
// arrays of ORIGINAL-array-order indices. Resolves them to holiday ids and inserts.
export async function migrateLegacyPicks({ employeeId, all, pickedIds, legacyData, storage = window.localStorage }) {
  const raw = storage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return { inserted: null, pickedIds }

  storage.removeItem(LEGACY_STORAGE_KEY)
  let mapping
  try {
    mapping = JSON.parse(raw) || {}
  } catch {
    return { inserted: null, pickedIds }
  }
  if (!Object.keys(mapping).length) return { inserted: null, pickedIds }

  const meta = new Map(all.map((h) => [h.id, h]))
  const perCell = {}
  pickedIds.forEach((id) => {
    const m = meta.get(id)
    if (m) {
      const k = `${m.country}|${m.year}`
      perCell[k] = (perCell[k] ?? 0) + 1
    }
  })

  const seen = new Set()
  const toInsert = []
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
      if (row && !seen.has(row.id)) {
        seen.add(row.id)
        toInsert.push({ employee_id: employeeId, holiday_id: row.id })
        used++
      }
    })
  })

  if (toInsert.length) {
    const { error } = await supabase.from('optional_holiday_picks').insert(toInsert)
    if (error) console.warn('Pick migration partial:', error.message)
    const { data: fresh } = await supabase.from('optional_holiday_picks').select('holiday_id').eq('employee_id', employeeId)
    return { inserted: toInsert, pickedIds: (fresh ?? []).map((r) => r.holiday_id) }
  }
  return { inserted: null, pickedIds }
}
