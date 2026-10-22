import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useDismiss } from '../hooks/useDismiss'
import { canApprove } from '../utils/roles'
import { fmtDays } from '../utils/format'
import { balanceRow } from '../utils/balances'
import { STATUSES } from '../constants'
import { buildNotifications } from '../features/notifications/buildNotifications'
import { IconButton } from './ui'
import ProfileMenu from './layout/ProfileMenu'
import NotificationsPanel from './layout/NotificationsPanel'
import SearchOverlay from './layout/SearchOverlay'
import ChatPanel from './layout/ChatPanel'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout, IconChevronDown,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck, IconSun, IconDoor,
  IconUser, IconSparkles,
} from './Icons'
import type { IconComponent } from './Icons'
import type { LeaveRequestRow, TeamRequestRow } from '../types/models'

import logo from '../assets/emids-logo.svg'

export interface NavItem {
  to: string
  num: string
  label: string
  icon: IconComponent
}

export const NAV: NavItem[] = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: IconDashboard },
  { to: '/apply-leave', num: '2', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '4', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '5', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '6', label: 'Separation Request', icon: IconDoor },
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  // Session-scoped "viewed" set: keys already surfaced via the bell dialog.
  const [seenNotifs, setSeenNotifs] = useState<Set<string>>(() => new Set())
  const { signOut, profile, mine, team, balances } = useAuth()
  // During sign-out the store clears to empty; partial suppliers must not crash.
  const mineRows = useMemo(() => (Array.isArray(mine) ? mine : EMPTY_ROWS) as LeaveRequestRow[], [mine])
  const teamRows = useMemo(() => (Array.isArray(team) ? team : EMPTY_ROWS) as TeamRequestRow[], [team])
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLDivElement | null>(null)
  useDismiss(drawerRef, { onClose: () => setOpen(false), enabled: open })

  const visibleNav = useMemo(
    () => NAV.filter((n) => canApprove(profile) || n.to !== '/leave-requests'),
    [profile]
  )

  const pendingRequests = teamRows.filter((r) => r.status === STATUSES.Pending).length

  const notifications = useMemo(() => buildNotifications(profile, mineRows, teamRows), [profile, mineRows, teamRows])
  const unseenCount = useMemo(
    () => notifications.filter((n) => !seenNotifs.has(n.key)).length,
    [notifications, seenNotifs]
  )
  const markNotificationsSeen = useCallback(() => {
    setSeenNotifs((prev) => {
      if (notifications.every((n) => prev.has(n.key))) return prev
      const next = new Set(prev)
      notifications.forEach((n) => next.add(n.key))
      return next
    })
  }, [notifications])

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  const toggleSearch = useCallback(() => {
    setProfileOpen(false)
    setNotifOpen(false)
    setSearchOpen(true)
  }, [])

  const toggleNotifications = useCallback(() => {
    setProfileOpen(false)
    setSearchOpen(false)
    markNotificationsSeen()
    setNotifOpen(true)
  }, [markNotificationsSeen])

  // The pop backdrop sits above the header, so closing always lands here —
  // re-marking seen is idempotent and cheap.
  const closeNotifications = useCallback(() => {
    setNotifOpen(false)
    markNotificationsSeen()
  }, [markNotificationsSeen])

  const navigateFromPop = useCallback((to: string) => {
    setNotifOpen(false)
    setSearchOpen(false)
    setProfileOpen(false)
    markNotificationsSeen()
    navigate(to)
  }, [markNotificationsSeen, navigate])

  // "/" opens global search from any page — unless the user is already typing.
  useEffect(() => {
    const onSearchHotkey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) return
      if (searchOpen || notifOpen || profileOpen || open) return
      e.preventDefault()
      toggleSearch()
    }
    document.addEventListener('keydown', onSearchHotkey)
    return () => document.removeEventListener('keydown', onSearchHotkey)
  }, [searchOpen, notifOpen, profileOpen, open, toggleSearch])

  const goto = (to: string) => { navigate(to); setOpen(false); setProfileOpen(false) }
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

        <button className="header__logo" aria-label="Emids home" onClick={() => goto('/dashboard')}>
          <img src={logo} alt="Emids" />
        </button>

        <div className="header__title">Absence Management</div>

        <div className="header__right">
          <IconButton
            label="Search"
            title="Search"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onClick={toggleSearch}
          >
            <IconSearch size={21} />
          </IconButton>
          <IconButton
            label={unseenCount > 0 ? `Notifications (${unseenCount} new)` : 'Notifications'}
            title="Notifications"
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            onClick={toggleNotifications}
          >
            <IconBell size={21} />
            {unseenCount > 0 && (
              <span className="icon-btn__count" aria-hidden="true">
                {unseenCount > 9 ? '9+' : unseenCount}
              </span>
            )}
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
        {notifOpen && (
          <NotificationsPanel
            notifications={notifications}
            onNavigate={navigateFromPop}
            onDismiss={closeNotifications}
          />
        )}
        {searchOpen && (
          <SearchOverlay
            nav={visibleNav}
            profile={profile}
            mine={mineRows}
            team={teamRows}
            onNavigate={navigateFromPop}
            onDismiss={() => setSearchOpen(false)}
          />
        )}
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
          {visibleNav.map(({ to, num, label, icon: Icon }) => (
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
