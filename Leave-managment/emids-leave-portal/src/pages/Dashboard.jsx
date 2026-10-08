import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND } from '../constants'
import { canApprove } from '../utils/roles'
import { todayISO } from '../utils/dates'
import { EMPTY_BALANCES } from '../features/balances/rules'
import { findNextHoliday, formatHolidayTicker } from '../features/holidays/ticker'
import { Button, Donut, PageHead } from '../components/ui'
import { fetchUpcomingHolidays, fetchOptionalPicks } from '../services/holidays'
import {
  IconCalendarPlus, IconFileText, IconClipboardCheck, IconLifebuoy, IconSun,
} from '../components/Icons'

const ACTIONS = [
  { to: '/apply-leave', title: 'Apply Leave', text: 'Time off, WFH, comp-off — logged against live balances.', icon: IconCalendarPlus },
  { to: '/leave-details', title: 'My Requests', text: 'Every request you have raised, with its current status.', icon: IconFileText },
  { to: '/leave-requests', title: 'Leave Requests', text: 'Approve or reject your team’s pending time off.', icon: IconClipboardCheck },
  { to: '/holidays', title: 'Holidays', text: 'Company-wide and optional holidays, with your own three picks.', icon: IconSun },
]

const firstName = (fullName) => (fullName ?? '').split(' ').slice(0, 2).join(' ').trim()

export default function Dashboard() {
  const navigate = useNavigate()
  const { setToast, profile, balances: fetched } = useAuth()

  const balances = fetched ?? EMPTY_BALANCES

  const [nextHoliday, setNextHoliday] = useState(null)

  useEffect(() => {
    let alive = true
    async function run() {
      const { rows, error } = await fetchUpcomingHolidays(todayISO())
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      if (!alive || !rows.length) return
      let picks = null
      if (profile?.id) {
        const { holidayIds } = await fetchOptionalPicks(profile.id)
        if (!alive) return
        picks = new Set(holidayIds)
      }
      const next = findNextHoliday(rows, picks, profile?.location)
      if (alive) setNextHoliday(next)
    }
    run()
    return () => { alive = false }
  }, [profile?.id, profile?.location, setToast])

  const holidayOut = useMemo(() => formatHolidayTicker(nextHoliday), [nextHoliday])

  return (
    <div className="page">
      <PageHead eyebrow={`Dashboard · ${profile?.location}`} title={`Welcome, ${firstName(profile?.full_name)}.`} />

      {holidayOut && (
        <aside className="hol-strip" aria-label="Upcoming holiday">
          <IconSun size={19} />
          <span className="eyebrow">Next holiday</span>
          <b className="hol-strip__name">{holidayOut.name}</b>
          <span className="hol-strip__meta mono">{holidayOut.dateLabel} · {holidayOut.kind.toUpperCase()}</span>
          <span className="hol-strip__when mono">{holidayOut.when}</span>
        </aside>
      )}

      {/* 1 · Leave balances + quick actions */}
      <section className="dash-top">
        <div className="card card--padded brand-frame dash-balance__main">
          <div className="dash-balance__head">
            <span className="eyebrow">Annual Leave · Used vs Credited</span>
          </div>

          <div className="dash-balance__grid">
            <div className="dash-donut">
              <Donut used={balances.utilized} total={balances.totalCredited} label={`${balances.utilized} / ${balances.totalCredited} DAYS`} />
              <div className="dash-donut__cap mono">ANNUAL POOL · AS OF TODAY</div>
            </div>

            <div className="dash-bars">
              {balances.rows.map((r) => (
                <div className="bar-row" key={r.key}>
                  <span className="bar-row__label">{r.label}</span>
                  <span className="bar-row__track">
                    <span
                      className="bar-row__fill"
                      style={{ width: `${Math.min(100, (r.value / r.max) * 100)}%` }}
                    />
                  </span>
                  <span className="bar-row__val mono">{r.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-note">
            <b>HR note</b> — Balances refresh on the 1st of every month. Contingency utilisation
            beyond 10 days requires HR sign-off. LWP requests route to Operations after approval.
          </div>
        </div>

        <div className="dash-actions" aria-label="Quick actions">
          {ACTIONS.filter((a) => canApprove(profile) || a.to !== '/leave-requests').map((a) => (
            <button key={a.to} className="card action-card brand-frame" onClick={() => navigate(a.to)}>
              <a.icon className="action-card__icon" size={26} />
              <div className="action-card__title">{a.title}</div>
              <p className="action-card__text">{a.text}</p>
              <span className="action-card__go">OPEN</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2 · Support Centre — footer */}
      <aside className="card card--padded support-panel support-panel--footer">
        <div className="support-panel__body">
          <span className="eyebrow">Support Centre</span>
          <div className="support-panel__title">Need a hand with time off?</div>
          <p>
            Policy clarifications, balance corrections, long-duration leave or missing credits —
            the People Success desk replies within one working day.
          </p>
        </div>
        <div className="support-panel__side">
          <ul className="support-panel__list mono">
            <li>SLA · 1 BUSINESS DAY</li>
            <li>CHANNEL · PORTAL + EMAIL</li>
            <li>COVERAGE · ALL ACCOUNTS</li>
          </ul>
          <Button variant='ghost' className='support-panel__btn' onClick={() => setToast('Help desk ticket draft opened (demo)')}>
            <IconLifebuoy size={16} /> Help desk
          </Button>
        </div>
      </aside>
    </div>
  )
}
