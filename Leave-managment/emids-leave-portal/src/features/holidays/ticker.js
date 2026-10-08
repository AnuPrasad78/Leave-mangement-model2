export function findNextHoliday(rows, picks, location) {
  const city = (location ?? '').split(',')[0].trim().toLowerCase()
  return (
    rows.find((h) =>
      h.kind === 'optional'
        ? picks?.has(h.id)
        : !city || String(h.location ?? '').toLowerCase().includes(city)
    ) ?? null
  )
}

export function formatHolidayTicker(nextHoliday, now = new Date()) {
  if (!nextHoliday) return null
  const d = new Date(`${nextHoliday.holiday_date}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  return {
    name: nextHoliday.name,
    dateLabel: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase(),
    when: diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : `IN ${diff} DAYS`,
    kind: nextHoliday.kind,
  }
}
