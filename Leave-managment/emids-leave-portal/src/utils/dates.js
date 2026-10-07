const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export const dayName = (iso) => weekDays[new Date(iso + 'T00:00:00').getDay()]

export const businessDaysBetween = (from, to) => {
  let count = 0
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// Local calendar date ("YYYY-MM-DD"). Supabase stores plain dates; the legacy
// UTC-shifted new Date().toISOString().slice(0, 10) slipped a day for
// evening-hour users in positive UTC offsets.
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
