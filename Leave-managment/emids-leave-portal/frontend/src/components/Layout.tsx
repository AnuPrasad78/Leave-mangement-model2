
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useDismiss } from '../hooks/useDismiss'
import { canApprove, isAdmin } from '../utils/roles'
import { fmtDays } from '../utils/format'
import { balanceRow } from '../utils/balances'
import { STATUSES } from '../constants'
import { IconButton } from './ui'
import ProfileMenu from './layout/ProfileMenu'
import ChatPanel from './layout/ChatPanel'
import NotificationsPanel from './layout/NotificationsPanel'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout, IconChevronDown,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck,
  IconSun, IconDoor, IconSparkles, IconUser, IconSitemap,
} from './Icons'
import type { IconComponent } from './Icons'
import type { TeamRequestRow } from '../types/models'

import logo from '../assets/emids-logo.svg'

export interface NavItem {
  to: string
  num: string
  label: string
  icon: IconComponent
  admin?: boolean
}

export const NAV: NavItem[] = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: IconDashboard },
  { to: '/apply-leave', num: '2', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '4', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '5', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '6', label: 'Separation Request', icon: IconDoor },
  { to: '/admin', num: '7', label: 'Admin · Overview', icon: IconDashboard, admin: true },
  { to: '/admin/employees', num: '8', label: 'Admin · Employees', icon: IconUser, admin: true },
  { to: '/admin/leave-policies', num: '9', label: 'Admin · Policies', icon: IconSun, admin: true },
  { to: '/admin/audit-logs', num: '10', label: 'Admin · Audit Logs', icon: IconFileText, admin: true },
  { to: '/admin/requests-stale', num: '11', label: 'Admin · Stale Review', icon: IconClipboardCheck, admin: true },
  { to: '/admin/reminders', num: '12', label: 'Admin · Reminders', icon: IconBell, admin: true },
  { to: '/admin/roster', num: '13', label: 'Admin · Roster', icon: IconSitemap, admin: true },
]

export interface LayoutProps {
  children: ReactNode
}

// Stable fallback so the session-clearing path never hands useMemo a fresh [].
const EMPTY_ROWS: never[] = []

export default function Layout({ children }: LayoutProps) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)

  const { signOut, profile, team, balances } = useAuth()
  const navigate = useNavigate()

  const drawerRef = useRef<HTMLDivElement | null>(null)

  useDismiss(drawerRef, {
    onClose: () => setOpen(false),
    enabled: open,
  })

  // During sign-out the store clears to empty; partial suppliers must not crash.
  const teamRows = useMemo(() => (Array.isArray(team) ? team : EMPTY_ROWS) as TeamRequestRow[], [team])

  // Filter navigation based on user permissions.
  const visibleNav = useMemo(
    () =>
      NAV.filter((item) => {
        if (item.admin) return isAdmin(profile)
        if (item.to === '/leave-requests') return canApprove(profile)
        return true
      }),
    [profile]
  )

  const pendingRequests = teamRows.filter((r) => r.status === STATUSES.Pending).length

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const weekday = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
  })

  const goto = (to: string) => {
    navigate(to)
    setOpen(false)
    setProfileOpen(false)
  }

  const logout = async () => {
    if (!await signOut()) return

    setOpen(false)
    setProfileOpen(false)
    navigate('/login')
  }

  const ann = balanceRow(balances, 'available')
  const cont = balanceRow(balances, 'contAvailable')

  return (
    <div className="shell">
      <div className="topbar" />

      <header className="header">
        <IconButton label="Menu" onClick={() => setOpen(true)}>
          <IconMenu size={22} />
        </IconButton>

        <button
          className="header__logo"
          aria-label="Emids home"
          onClick={() => goto('/dashboard')}
        >
          <img src={logo} alt="Emids" />
        </button>

        <div className="header__title">Absence Management</div>

        <div className="header__right">
          <IconButton label="Search" onClick={() => goto('/leave-details')}>
            <IconSearch size={21} />
          </IconButton>

          <IconButton
            label={notifsOpen ? 'Hide notifications' : 'Show notifications'}
            aria-haspopup="dialog"
            aria-expanded={notifsOpen}
            className={`header__profile${notifsOpen ? ' is-open' : ''}`}
            onClick={() => setNotifsOpen((v) => !v)}
          >
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

        {profileOpen && (
          <ProfileMenu
            profile={profile}
            onDismiss={() => setProfileOpen(false)}
          />
        )}

        {notifsOpen && <NotificationsPanel onDismiss={() => setNotifsOpen(false)} />}
      </header>

      <main className="content">{children}</main>

      {open && <div className="drawer-backdrop" aria-hidden="true" />}

      <div
        className="drawer"
        ref={drawerRef}
        style={
          open
            ? {}
            : {
                transform: 'translateX(-100%)',
                visibility: 'hidden',
                transition: 'transform 240ms var(--ease-resolve), visibility 0s 240ms',
              }
        }
      >
        <div className="drawer__topbar" />

        <div className="drawer__profile">
          <span className="avatar">{profile?.initials}</span>

          <div>
            <div className="drawer__name">{profile?.full_name}</div>
            <div className="drawer__role">
              {profile?.job_title} · {profile?.emp_no}
            </div>
          </div>

          <IconButton label="Close menu" onClick={() => setOpen(false)}>
            <IconX size={19} />
          </IconButton>
        </div>

        {balances && ann && cont && (
          <div className="drawer__counts">
            <div className="drawer__count">
              <b>
                {fmtDays(ann.value)} / {fmtDays(balances.totalCredited)}
              </b>
              <span>Annual leave</span>
            </div>

            <div className="drawer__count">
              <b>
                {fmtDays(cont.value)} / {fmtDays(cont.max ?? 10)}
              </b>
              <span>Contingency</span>
            </div>
          </div>
        )}

        <nav className="drawer__nav">
          {visibleNav.map(({ to, num, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="nav-item"
              onClick={() => setOpen(false)}
            >
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
            <span>
              <b>TODAY</b> · {weekday}
            </span>
            <span>{today}</span>
          </div>

          <button
            className="btn btn--ghost btn--logout"
            onClick={logout}
          >
            <IconLogout size={15} /> Log out
          </button>
        </div>
      </div>

      {/* Demo AI assistant */}
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
        <ChatPanel
          profile={profile}
          onDismiss={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}
