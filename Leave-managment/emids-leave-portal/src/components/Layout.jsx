import { useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useDismiss } from '../hooks/useDismiss'
import { canApprove } from '../utils/roles'
import { fmtDays } from '../utils/format'
import { balanceRow } from '../utils/balances'
import { STATUSES } from '../constants'
import { IconButton } from './ui'
import ProfileMenu from './layout/ProfileMenu'
import ChatPanel from './layout/ChatPanel'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout, IconChevronDown,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck, IconSun, IconDoor,
  IconSparkles, IconUser,
} from './Icons'

import logo from '../assets/emids-logo.svg'

export const NAV = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: IconDashboard },
  { to: '/apply-leave', num: '2', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '4', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '5', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '6', label: 'Separation Request', icon: IconDoor },
]

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { signOut, profile, team, balances } = useAuth()
  const navigate = useNavigate()
  const drawerRef = useRef(null)
  useDismiss(drawerRef, { onClose: () => setOpen(false), enabled: open })

  const pendingRequests = team.filter((r) => r.status === STATUSES.Pending).length

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  const goto = (to) => { navigate(to); setOpen(false); setProfileOpen(false) }
  const logout = () => { signOut(); setOpen(false); setProfileOpen(false); navigate('/login') }

  const ann = balanceRow(balances, 'available')
  const cont = balanceRow(balances, 'contAvailable')

  return (
    <div className="shell">
      <div className="topbar" />

      <header className="header">
        <IconButton label="Menu" onClick={() => setOpen(true)}>
          <IconMenu size={22} />
        </IconButton>

        <button className="header__logo" aria-label="Emids home" onClick={() => goto('/dashboard')}>
          <img src={logo} alt="Emids" />
        </button>

        <div className="header__title">Absence Management</div>

        <div className="header__right">
          <IconButton label="Search" onClick={() => goto('/leave-details')}>
            <IconSearch size={21} />
          </IconButton>
          <IconButton label="Notifications" onClick={() => goto('/leave-requests')}>
            <IconBell size={21} />
            <span className="icon-btn__dot" />
          </IconButton>
          <IconButton
            label={profileOpen ? 'Hide my profile' : 'Show my profile'}
            className={`header__profile${profileOpen ? ' is-open' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            title="My profile"
            onClick={() => setProfileOpen((v) => !v)}
          >
            <IconUser size={23} />
            <IconChevronDown size={13} />
          </IconButton>
        </div>

        {profileOpen && <ProfileMenu profile={profile} onDismiss={() => setProfileOpen(false)} />}
      </header>

      <main className="content">{children}</main>

      {open && <div className="drawer-backdrop" aria-hidden="true" />}
      <div
        className="drawer"
        ref={drawerRef}
        style={open ? {} : { transform: 'translateX(-100%)', visibility: 'hidden', transition: 'transform 240ms var(--ease-resolve), visibility 0s 240ms' }}
      >
        <div className="drawer__topbar" />

        <div className="drawer__profile">
          <span className="avatar">{profile?.initials}</span>
          <div>
            <div className="drawer__name">{profile?.full_name}</div>
            <div className="drawer__role">{profile?.job_title} · {profile?.emp_no}</div>
          </div>
          <IconButton label="Close menu" onClick={() => setOpen(false)}>
            <IconX size={19} />
          </IconButton>
        </div>

        {balances && ann && cont && (
          <div className="drawer__counts">
            <div className="drawer__count">
              <b>{fmtDays(ann.value)} / {fmtDays(balances.totalCredited)}</b>
              <span>Annual leave</span>
            </div>
            <div className="drawer__count">
              <b>{fmtDays(cont.value)} / {fmtDays(cont.max ?? 10)}</b>
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

      {chatOpen && <ChatPanel profile={profile} onDismiss={() => setChatOpen(false)} />}
    </div>
  )
}
