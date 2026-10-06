import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { Donut, Rise } from '../components/UI'
import {
  IconCalendarPlus, IconFileText, IconClipboardCheck, IconArrowUpRight,
  IconId, IconBuilding, IconBriefcase, IconSitemap, IconUserCheck, IconLifebuoy, IconMail,
} from '../components/Icons'

const ACTIONS = [
  { to: '/apply-leave', num: '01', title: 'Apply Leave', text: 'Time off, WFH, comp-off — logged against live balances.', icon: IconCalendarPlus },
  { to: '/leave-details', num: '02', title: 'My Requests', text: 'Every request you have raised, with its current status.', icon: IconFileText },
  { to: '/leave-requests', num: '03', title: 'Leave Requests', text: 'Approve or reject your team’s pending time off.', icon: IconClipboardCheck },
]

const firstName = (fullName) => (fullName ?? '').split(' ').slice(0, 2).join(' ').trim()

export default function Dashboard() {
  const navigate = useNavigate()
  const { setToast, profile, balances: fetched, team } = useAuth()

  const balances = fetched ?? { totalCredited: 0, utilized: 0, rows: [] }
  const teamPending = team ? team.filter((r) => r.status === 'Pending').length : 0
  const showStrip = profile?.system_role === 'manager' && teamPending > 0

  const DETAILS = [
    { label: 'Emp ID', value: profile?.emp_no, icon: IconId },
    { label: 'Account', value: profile?.account, icon: IconBuilding },
    { label: 'Project', value: profile?.project_name, icon: IconBriefcase },
    { label: 'Function', value: profile?.function_name, icon: IconSitemap },
    { label: 'Manager', value: profile?.manager?.full_name, icon: IconUserCheck },
  ]

  return (
    <div className="page">
      <Rise as="header" i={0} className="page-head">
        <span className="eyebrow">↘ Dashboard · {profile?.location}</span>
        <h1>Welcome, {firstName(profile?.full_name)}.</h1>
      </Rise>

      {/* 1 · Employee overview */}
      <Rise as="section" i={1} className="card brand-frame card--padded dash-overview">
        <div className="dash-overview__who">
          <span className="avatar avatar--lg">{profile?.initials}</span>
          <div>
            <h2>{profile?.full_name}</h2>
            <div className="dash-role mono">{profile?.job_title} · {profile?.system_role?.toUpperCase()}</div>
            <div className="dash-mail"><IconMail size={14} /> {profile?.email}</div>
          </div>
        </div>
        <dl className="dash-fields">
          {DETAILS.map(({ label, value, icon: Icon }) => (
            <div className="dash-field" key={label}>
              <dt><Icon size={14} /> {label}</dt>
              <dd>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Rise>

      {/* 2 · Manager queue glanceable */}
      {showStrip && (
        <Rise as="section" i={2} className="card brand-frame card--padded queue-strip">
          <div className="queue-strip__text">
            <span className="eyebrow">↘ Team queue</span>
            <strong>
              {teamPending} pending request{teamPending === 1 ? '' : 's'}{' '}
              {teamPending === 1 ? 'needs' : 'need'} your decision
            </strong>
          </div>
          <button className="btn btn--ghost" onClick={() => navigate('/leave-requests')}>
            REVIEW →
          </button>
        </Rise>
      )}

      {/* 2b · Quick actions */}
      <section className="dash-actions" aria-label="Quick actions">
        {ACTIONS.map((a, idx) => (
          <Rise
            key={a.num}
            as="button"
            i={idx + (showStrip ? 2 : 1)}
            className={`card action-card brand-frame ${idx === 0 ? 'action-card--featured' : ''}`}
            onClick={() => navigate(a.to)}
          >
            <div className="action-card__head">
              <span className="eyebrow">↘ {a.num} / Action</span>
              <IconArrowUpRight size={18} />
            </div>
            <span className="action-card__icon-tile">
              <a.icon size={20} />
            </span>
            <div className="action-card__title">{a.title}</div>
            <p className="action-card__text">{a.text}</p>
            <span className="action-card__go">OPEN <IconArrowUpRight size={12} /></span>
          </Rise>
        ))}
      </section>

      {/* 3 · Leave balances */}
      <Rise as="section" i={showStrip ? 6 : 5} className="dash-balances">
        <div className="card card--padded brand-frame dash-balance__main">
          <div className="dash-balance__head">
            <span className="eyebrow">↘ Annual Leave · Used vs Credited</span>
            <span className="eyebrow eyebrow--ink">FIG. 03.00</span>
          </div>

          <div className="dash-balance__grid">
            {!fetched ? (
              <div className="dash-donut" aria-hidden="true">
                <div className="dash-sk-donut skeleton" />
                <div className="dash-sk-cap skeleton" />
              </div>
            ) : (
              <div className="dash-donut">
                <Donut used={balances.utilized} total={balances.totalCredited} label={`${balances.utilized} / ${balances.totalCredited} DAYS`} />
                <div className="dash-donut__cap mono">ANNUAL POOL · AS OF TODAY</div>
              </div>
            )}

            <div className="dash-bars">
              {!fetched
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div className="bar-row" key={`sk-${i}`} aria-hidden="true">
                      <span className="bar-row__skel-label skeleton" />
                      <span className="bar-row__skel-track skeleton" />
                      <span className="bar-row__skel-val skeleton" />
                    </div>
                  ))
                : balances.rows.map((r, i) => (
                    <div className="bar-row" key={r.key}>
                      <span className="bar-row__label">
                        {i + 1 < 10 ? `0${i + 1}` : i + 1} · {r.label}
                      </span>
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

        <aside className="card card--padded support-panel">
          <span className="eyebrow">↘ Support Centre</span>
          <div className="support-panel__title">Need a hand with time off?</div>
          <p>
            Policy clarifications, balance corrections, long-duration leave or missing credits —
            the People Success desk replies within one working day.
          </p>
          <ul className="support-panel__list mono">
            <li>SLA · 1 BUSINESS DAY</li>
            <li>CHANNEL · PORTAL + EMAIL</li>
            <li>COVERAGE · ALL ACCOUNTS</li>
          </ul>
          <button
            className="btn btn--ghost support-panel__btn"
            onClick={() => setToast('Help desk ticket draft opened (demo)')}
          >
            <IconLifebuoy size={16} /> Help desk
          </button>
        </aside>
      </Rise>
    </div>
  )
}
