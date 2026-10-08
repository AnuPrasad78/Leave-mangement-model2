import { useEffect, useMemo, useState } from 'react'
import { dayName } from '../utils/dates'
import { useAuth } from '../store/AuthContext'
import { MAX_PICKS, TOAST_KIND } from '../constants'
import { Chip, Field, PageHead, PanelTable } from '../components/ui'
import { fetchAllHolidays } from '../services/holidays'
import { useHolidayPicks } from '../features/holidays/useHolidayPicks'

export default function Holidays() {
  const { setToast, profile } = useAuth()
  const [all, setAll] = useState(null) // all holiday rows; null while loading
  const [country, setCountry] = useState('India')
  const [location, setLocation] = useState('Bangalore')
  const [year, setYear] = useState(2026)

  const { picks, chosen, togglePick } = useHolidayPicks({ profile, setToast, all, country, year })

  useEffect(() => {
    async function run() {
      const { rows, error } = await fetchAllHolidays()
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setAll(rows)
    }
    run()
  }, [setToast])

  const countries = useMemo(() => [...new Set((all ?? []).map((h) => h.country))], [all])
  const locations = useMemo(
    () => [...new Set((all ?? []).filter((h) => h.country === country && h.kind === 'fixed' && h.location).map((h) => h.location))],
    [all, country]
  )
  const years = useMemo(
    () => [...new Set((all ?? []).filter((h) => h.country === country && h.kind === 'fixed').map((h) => h.year))].sort((a, b) => b - a),
    [all, country]
  )

  useEffect(() => {
    if (locations.length && !locations.includes(location)) setLocation(locations[0])
  }, [location, locations])
  useEffect(() => {
    if (years.length && !years.includes(Number(year))) setYear(Number(years[0]))
  }, [year, years])

  const fixed = useMemo(
    () => (all ?? []).filter((h) => h.country === country && h.location === location && h.kind === 'fixed' && h.year === Number(year)),
    [all, country, location, year]
  )
  const optional = useMemo(
    () => (all ?? []).filter((h) => h.country === country && h.kind === 'optional' && h.year === Number(year)),
    [all, country, year]
  )

  const loading = all === null

  const fixedColumns = [
    { label: 'Date', cellClass: 'nowrap', cell: (h) => <span className="hl-date"><b>{h.holiday_date.slice(5)}</b><span>{h.holiday_date.slice(0, 4)}</span></span> },
    { label: 'Day', cellClass: 'nowrap mono', cell: (h) => dayName(h.holiday_date) },
    { label: 'Holiday', cell: (h) => h.name },
  ]
  const optionalColumns = [
    {
      label: 'Pick',
      width: 44,
      cell: (h) => {
        const isPicked = picks?.has(h.id)
        return (
          <Chip className="opt-choice" isOn={isPicked} aria-label={`Choose ${h.name}`} onClick={() => togglePick(h)}>
            ✓
          </Chip>
        )
      },
    },
    ...fixedColumns,
  ]

  return (
    <div className="page">
      <PageHead eyebrow="Company Calendar" title="Holiday calendar.">
        <p>
          Compare locations before you plan. Optional holidays are employee-selected —
          pick three for the year, they switch to paid leave on your request.
        </p>
      </PageHead>

      <div className="hl-filters">
        <Field label="Country" as="div">
          <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Location" as="div">
          <select className="select" value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Year" as="div">
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </Field>
        <div className="hl-meter" style={{ marginLeft: 'auto' }}>
          CHOSEN <b>{picks === null ? '…' : chosen.length}</b> / {MAX_PICKS}
        </div>
      </div>

      <div className="hl-cols">
        <PanelTable
          title={`Fixed holidays · ${location}`}
          count={`${fixed.length} DAYS OFF · PAID`}
          columns={fixedColumns}
          rows={fixed}
          rowKey={(h) => h.id}
          empty={loading ? 'Loading calendar…' : 'No holidays on file.'}
        />

        <PanelTable
          title={`Optional holidays · Choose ${MAX_PICKS} out of ${optional.length}`}
          count={`${chosen.length} / ${MAX_PICKS} SELECTED`}
          columns={optionalColumns}
          rows={optional}
          rowKey={(h) => h.id}
          rowClass={(h) => (picks?.has(h.id) ? 'optional-row is-chosen' : 'optional-row')}
          empty={loading ? 'Loading calendar…' : 'No holidays on file.'}
        />
      </div>
    </div>
  )
}
