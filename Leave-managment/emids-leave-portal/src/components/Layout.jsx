import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { canApprove } from '../data'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout, IconChevronDown,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck, IconSun, IconDoor,
  IconMail, IconId, IconBuilding, IconBriefcase, IconSitemap, IconUserCheck, IconUser, IconSparkles,
} from './Icons'

import logo from '../assets/emids-logo.svg'

const NAV = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: IconDashboard },
  { to: '/apply-leave', num: '2', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '4', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '5', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '6', label: 'Separation Request', icon: IconDoor },
]

const CHAT_OPTIONS = [
  'How do I apply for leave?',
  'Why does my balance differ?',
  'Cancel a submitted request',
  'Who approves contingency leave?',
]

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { signOut, profile, team, balances } = useAuth()
  const navigate = useNavigate()

  const pendingRequests = team.filter((r) => r.status === 'Pending').length
  const fmtDays = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  useEffect(() => {
    if (!profileOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setProfileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileOpen])

  const goto = (to) => { navigate(to); setOpen(false); setProfileOpen(false) }
  const logout = () => { signOut(); setOpen(false); setProfileOpen(false); navigate('/login') }

  const DETAILS = [
    { label: 'Emp ID', value: profile?.emp_no, icon: IconId },
    { label: 'Account', value: profile?.account, icon: IconBuilding },
    { label: 'Project', value: profile?.project_name, icon: IconBriefcase },
    { label: 'Function', value: profile?.function_name, icon: IconSitemap },
    { label: 'Manager', value: profile?.manager?.full_name, icon: IconUserCheck },
  ]

  return (
    <div className="shell">
      <div className="topbar" />

      <header className="header">
        <button className="icon-btn" aria-label="Menu" title="Menu" onClick={() => setOpen(true)}>
          <IconMenu size={22} />
        </button>

        <a href="#" className="header__logo" aria-label="Emids home" onClick={(e) => { e.preventDefault(); goto('/dashboard') }}>
          <img src={logo} alt="Emids" />
        </a>

        <div className="header__title">Absence Management</div>

        <div className="header__right">
          <button className="icon-btn" aria-label="Search" title="Search" onClick={() => goto('/leave-details')}>
            <IconSearch size={21} />
          </button>
          <button className="icon-btn" aria-label="Notifications" title="Notifications" onClick={() => goto('/leave-requests')}>
            <IconBell size={21} />
            <span className="icon-btn__dot" />
          </button>
          <button
            className={`icon-btn header__profile ${profileOpen ? 'is-open' : ''}`}
            aria-label={profileOpen ? 'Hide my profile' : 'Show my profile'}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            title="My profile"
            onClick={() => setProfileOpen((v) => !v)}
          >
            <IconUser size={23} />
            <IconChevronDown size={13} />
          </button>
        </div>

        {profileOpen && (
          <>
            <div className="pop-backdrop" onClick={() => setProfileOpen(false)} />
            <div className="profile-pop" role="dialog" aria-label="My profile">
              <div className="pop-bar" />
              <div className="profile-pop__who">
                <span className="avatar avatar--lg">{profile?.initials}</span>
                <div>
                  <div className="profile-pop__name">{profile?.full_name}</div>
                  <div className="dash-role mono">{profile?.job_title} · {profile?.system_role}</div>
                  <div className="dash-mail"><IconMail size={14} /> {profile?.email}</div>
                </div>
              </div>
              <dl className="dash-fields profile-pop__fields">
                {DETAILS.map(({ label, value, icon: Icon }) => (
                  <div className="dash-field" key={label}>
                    <dt><Icon size={14} /> {label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}
      </header>

      <main className="content">{children}</main>

      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}
      <div
        className="drawer"
        style={open ? {} : { transform: 'translateX(-100%)', visibility: 'hidden', transition: 'transform 240ms var(--ease-resolve), visibility 0s 240ms' }}
      >
        <div className="drawer__topbar" />

        <div className="drawer__profile">
          <span className="avatar">{profile?.initials}</span>
          <div>
            <div className="drawer__name">{profile?.full_name}</div>
            <div className="drawer__role">{profile?.job_title} · {profile?.emp_no}</div>
          </div>
          <button className="icon-btn drawer__close" aria-label="Close menu" onClick={() => setOpen(false)}>
            <IconX size={19} />
          </button>
        </div>

        {balances && (
          <div className="drawer__counts">
            <div className="drawer__count">
              <b>{fmtDays(Math.max(0, balances.totalCredited - balances.utilized))} / {fmtDays(balances.totalCredited)}</b>
              <span>Annual leave</span>
            </div>
            <div className="drawer__count">
              <b>{fmtDays(Math.max(0, balances.rows.find((r) => r.key === 'contAvailable')?.value ?? 0))} / {fmtDays(balances.rows.find((r) => r.key === 'contAvailable')?.max ?? 10)}</b>
              <span>Contingency</span>
            </div>
          </div>
        )}

        <nav className="drawer__nav">
          {NAV.filter((n) => canApprove(profile) || n.to !== '/leave-requests').map(({ to, num, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-item" onClick={() => setOpen(false)}>
              <Icon size={18} />
              <span className="mono">{num}</span>
              <span className="nav-item__label">{label}</span>
              {to === '/leave-requests' && pendingRequests > 0 && (
                <span className="nav-item__badge" title={`${pendingRequests} pending request${pendingRequests > 1 ? 's' : ''}`}>
                  {pendingRequests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="drawer__foot">
          <div className="drawer__date">
            <span><b>TODAY</b> · {weekday}</span>
            <span>{today}</span>
          </div>
          <button className="btn btn--ghost btn--logout" onClick={logout}>
            <IconLogout size={15} /> Log out
          </button>
        </div>
      </div>

      {/* Demo AI assistant — opens a panel of options that are intentionally non-responsive */}
      <button
        className="chatfab"
        aria-label="AI assistant"
        aria-expanded={chatOpen}
        title="AI assistant"
        onClick={() => setChatOpen((v) => !v)}
      >
        <IconSparkles size={22} />
      </button>

      {chatOpen && (
        <div className="chatpanel" role="dialog" aria-label="AI assistant">
          <div className="chatpanel__head">
            <b>Leave assistant</b>
            <span className="mono">BETA</span>
            <button className="icon-btn chatpanel__close" aria-label="Close assistant" onClick={() => setChatOpen(false)}>
              <IconX size={17} />
            </button>
          </div>
          <div className="chatpanel__msg">
            Hi {profile?.full_name?.split(' ')[0] ?? 'there'} — tell me what you need. Pick a topic below.
          </div>
          <div className="chatpanel__opts">
            {CHAT_OPTIONS.map((o) => (
              <button key={o} className="chatpanel__opt">{o}</button>
            ))}
          </div>
          <div className="chatpanel__hint mono">DEMO · RESPONSES DISABLED</div>
        </div>
      )}
    </div>
  )
}
