import { useEffect, useMemo, useState } from 'react'
import { dayName } from '../utils/dates'
import { legacyHolidayData } from '../data/legacyHolidayData'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND, MAX_PICKS } from '../constants'
import { Chip, Field, PageHead, PanelTable } from '../components/ui'
import { fetchAllHolidays, fetchOptionalPicks, addOptionalPick, removeOptionalPick, isPickCapError } from '../services/holidays'
import { migrateLegacyPicks } from '../services/legacyMigration'

export default function Holidays() {
  const { setToast, profile } = useAuth()
  const [all, setAll] = useState(null)     // all holiday rows; null while loading
  const [picks, setPicks] = useState(null) // Set of holiday ids; null while loading
  const [country, setCountry] = useState('India')
  const [location, setLocation] = useState('Bangalore')
  const [year, setYear] = useState(2026)

  useEffect(() => {
    async function run() {
      const { rows, error } = await fetchAllHolidays()
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setAll(rows)
    }
    run()
  }, [setToast])

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
  const chosen = useMemo(
    () => (all ?? []).filter((h) => picks?.has(h.id) && h.country === country && h.year === Number(year) && h.kind === 'optional'),
    [all, picks, country, year]
  )

  const refetchPicks = async () => {
    if (!profile?.id) return
    const { holidayIds } = await fetchOptionalPicks(profile.id)
    setPicks(new Set(holidayIds))
  }

  const toggle = async (h) => {
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
          <Chip className="opt-choice" isOn={isPicked} aria-label={`Choose ${h.name}`} onClick={() => toggle(h)}>
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
