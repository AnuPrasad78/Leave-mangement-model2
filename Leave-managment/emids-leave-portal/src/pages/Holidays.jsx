import { useEffect, useMemo, useState } from 'react'
import { dayName } from '../data.js'
import { legacyHolidayData } from '../data/legacyHolidayData'
import { useAuth } from '../store/AuthContext'
import { supabase } from '../lib/supabase'

const LEGACY_KEY = 'emids-optional-holidays'
const MAX_PICKS = 3

export default function Holidays() {
  const { setToast, profile } = useAuth()
  const [all, setAll] = useState(null)     // all holiday rows; null while loading
  const [picks, setPicks] = useState(null) // Set of holiday ids; null while loading
  const [country, setCountry] = useState('India')
  const [location, setLocation] = useState('Bangalore')
  const [year, setYear] = useState(2026)

  useEffect(() => {
    async function run() {
      const { data } = await supabase
        .from('holidays')
        .select('id, country, location, year, kind, holiday_date, name')
        .order('holiday_date')
      setAll(data ?? [])
    }
    run()
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    async function run() {
      const { data } = await supabase
        .from('optional_holiday_picks')
        .select('holiday_id')
        .eq('employee_id', profile.id)
      setPicks(new Set((data ?? []).map((r) => r.holiday_id)))
    }
    run()
  }, [profile])

  // One-time migration: old localStorage emids-optional-holidays stored per-cell
  // arrays of ORIGINAL-array-order indices. Resolve them to holiday ids and insert.
  useEffect(() => {
    if (!profile?.id || !all || picks === null) return
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return

    localStorage.removeItem(LEGACY_KEY)
    let mapping = {}
    try { mapping = JSON.parse(raw) || {} } catch { return }
    if (!Object.keys(mapping).length) return

    const meta = new Map(all.map((h) => [h.id, h]))
    const perCell = {} // 'country|year' → picked count already in DB
    picks.forEach((id) => {
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
      const list = legacyHolidayData[cn]?.optional?.[Number(yr)] ?? []
      const budget = MAX_PICKS - (perCell[`${cn}|${Number(yr)}`] ?? 0)
      let used = 0
      ;(Array.isArray(idxs) ? idxs : []).forEach((i) => {
        if (used >= budget) return
        const h = list[Number(i)]
        if (!h) return
        const row = all.find(
          (x) => x.country === cn && x.year === Number(yr) && x.kind === 'optional'
            && x.holiday_date === h.date && x.name === h.name
        )
        if (row && !seen.has(row.id)) {
          seen.add(row.id)
          toInsert.push({ employee_id: profile.id, holiday_id: row.id })
          used++
        }
      })
    })

    if (toInsert.length) {
      (async () => {
        const { error } = await supabase.from('optional_holiday_picks').insert(toInsert)
        if (error) console.warn('Pick migration partial:', error.message)
        const { data: fresh } = await supabase
          .from('optional_holiday_picks')
          .select('holiday_id')
          .eq('employee_id', profile.id)
        setPicks(new Set((fresh ?? []).map((r) => r.holiday_id)))
      })()
    }
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
  }, [locations]) // eslint-disable-line
  useEffect(() => {
    if (years.length && !years.includes(Number(year))) setYear(Number(years[0]))
  }, [years]) // eslint-disable-line

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
    const { data } = await supabase
      .from('optional_holiday_picks')
      .select('holiday_id')
      .eq('employee_id', profile.id)
    setPicks(new Set((data ?? []).map((r) => r.holiday_id)))
  }

  const toggle = async (h) => {
    if (!profile?.id || picks === null) return
    if (picks.has(h.id)) {
      setPicks(new Set([...picks].filter((id) => id !== h.id)))
      const { error } = await supabase
        .from('optional_holiday_picks')
        .delete()
        .eq('employee_id', profile.id)
        .eq('holiday_id', h.id)
      if (error) {
        setToast(error.message, 'red')
        refetchPicks()
      }
      return
    }
    if (chosen.length >= MAX_PICKS) {
      setToast(`You can choose only ${MAX_PICKS} optional holidays`, 'red')
      return
    }
    const { error } = await supabase
      .from('optional_holiday_picks')
      .insert({ employee_id: profile.id, holiday_id: h.id })
    if (error) {
      if (/3 optional/.test(error.message)) setToast(`You can choose only ${MAX_PICKS} optional holidays`, 'red')
      else setToast(error.message, 'red')
      refetchPicks()
      return
    }
    setPicks(new Set([...picks, h.id]))
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">↘ 05 · Company Calendar</span>
        <h1>Holiday calendar.</h1>
        <p>
          Compare locations before you plan. Optional holidays are employee-selected —
          pick three for the year, they switch to paid leave on your request.
        </p>
      </header>

      <div className="hl-filters">
        <label className="field">
          <span className="field__label">01 · Country</span>
          <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">02 · Location</span>
          <select className="select" value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">03 · Year</span>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <div className="hl-meter" style={{ marginLeft: 'auto' }}>
          CHOSEN <b>{picks === null ? '…' : chosen.length}</b> / 3
        </div>
      </div>

      <div className="hl-cols">
        <div className="card">
          <div className="hl-panel-head">
            <h3>Fixed holidays · {location}</h3>
            <span className="hl-count">{fixed.length} DAYS OFF · PAID</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Day</th><th>Holiday</th></tr>
              </thead>
              <tbody>
                {fixed.map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap">
                      <span className="hl-date"><b>{h.holiday_date.slice(5)}</b><span>{h.holiday_date.slice(0, 4)}</span></span>
                    </td>
                    <td className="nowrap mono">{dayName(h.holiday_date)}</td>
                    <td>{h.name}</td>
                  </tr>
                ))}
                {fixed.length === 0 && (
                  <tr><td colSpan={3} className="table__empty">{all === null ? 'Loading calendar…' : 'No holidays on file.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="hl-panel-head">
            <h3>Optional holidays · Choose {MAX_PICKS} out of {optional.length}</h3>
            <span className="hl-count">{chosen.length} / {MAX_PICKS} SELECTED</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th style={{ width: 44 }}>Pick</th><th>Date</th><th>Day</th><th>Holiday</th></tr>
              </thead>
              <tbody>
                {optional.map((h) => {
                  const isPicked = picks?.has(h.id)
                  return (
                    <tr key={h.id} className={isPicked ? 'optional-row is-chosen' : 'optional-row'}>
                      <td>
                        <button
                          className={`opt-choice ${isPicked ? 'is-on' : ''}`}
                          aria-pressed={isPicked}
                          aria-label={`Choose ${h.name}`}
                          onClick={() => toggle(h)}
                        >
                          ✓
                        </button>
                      </td>
                      <td className="nowrap">
                        <span className="hl-date"><b>{h.holiday_date.slice(5)}</b><span>{h.holiday_date.slice(0, 4)}</span></span>
                      </td>
                      <td className="nowrap mono">{dayName(h.holiday_date)}</td>
                      <td>{h.name}</td>
                    </tr>
                  )
                })}
                {optional.length === 0 && (
                  <tr><td colSpan={4} className="table__empty">{all === null ? 'Loading calendar…' : 'No holidays on file.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
