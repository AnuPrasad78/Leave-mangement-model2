export const separationReasons = [
  'Better Opportunity',
  'Higher Studies',
  'Personal Reasons',
  'Health Reasons',
  'Relocation',
  'Entrepreneurship',
  'Career Break',
  'Other',
]

export const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

export const canApprove = (profile) =>
  profile?.system_role === 'manager' || profile?.system_role === 'admin'
