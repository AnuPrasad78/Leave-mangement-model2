
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useDismiss } from '../hooks/useDismiss'
import { canApprove, isAdmin } from '../utils/roles'
import { fmtDays } from '../utils/format'
import { balanceRow } from '../utils/balances'
import { STATUSES } from '../constants'
import { fetchMyNotifications } from '../services/notifications'
import { IconButton } from './ui'
import ProfileMenu from './layout/ProfileMenu'
import ChatPanel from './layout/ChatPanel'
import NotificationsPanel from './layout/NotificationsPanel'
import SearchPanel from './layout/SearchPanel'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout, IconChevronDown,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck,
  IconSun, IconDoor, IconSparkles, IconUser,
} from './Icons'
import type { IconComponent } from './Icons'
import type { LeaveRequestRow, TeamRequestRow } from '../types/models'

import logo from '../assets/emids-logo.svg'

export interface NavItem {
  to: string
  num: string
  label: string
  icon: IconComponent
  admin?: boolean
}

export const NAV: NavItem[] = [
  { to: '/admin', num: '1', label: 'Admin · Console', icon: IconDashboard, admin: true },
  { to: '/dashboard', num: '2', label: 'Leave Management', icon: IconDashboard },
  { to: '/apply-leave', num: '3', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '4', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '5', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '6', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '7', label: 'Separation Request', icon: IconDoor },
  { to: '/admin/employees', num: '8', label: 'Admin · Employees', icon: IconUser, admin: true },
  { to: '/admin/leave-policies', num: '9', label: 'Admin · Balances', icon: IconSun, admin: true },
  { to: '/admin/audit-logs', num: '10', label: 'Admin · Audit Logs', icon: IconFileText, admin: true },
  { to: '/admin/reminders', num: '11', label: 'Admin · Stale & Nudges', icon: IconBell, admin: true },
]

// Sidebar variant for admins: user-specific items (Apply Leave, My Requests,
// Leave Requests, Holiday Calendar) are dropped and Separation Request moves
// to the bottom. Regular users keep the plain NAV list above, untouched.
export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', num: '1', label: 'Admin · Console', icon: IconDashboard, admin: true },
  { to: '/dashboard', num: '2', label: 'Leave Management', icon: IconDashboard },
  { to: '/admin/employees', num: '3', label: 'Admin · Employees', icon: IconUser, admin: true },
  { to: '/admin/leave-policies', num: '4', label: 'Admin · Balances', icon: IconSun, admin: true },
  { to: '/admin/audit-logs', num: '5', label: 'Admin · Audit Logs', icon: IconFileText, admin: true },
  { to: '/admin/reminders', num: '6', label: 'Admin · Stale & Nudges', icon: IconBell, admin: true },
  { to: '/separation-request', num: '7', label: 'Separation Request', icon: IconDoor },
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
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const { signOut, profile, mine, team, balances } = useAuth()
  const navigate = useNavigate()

  const drawerRef = useRef<HTMLDivElement | null>(null)
  useDismiss(drawerRef, {
    onClose: () => setOpen(false),
    enabled: open,
  })

  // During sign-out the store clears to empty; partial suppliers must not crash.
  const teamRows = useMemo(() => (Array.isArray(team) ? team : EMPTY_ROWS) as TeamRequestRow[], [team])
  const mineRows = useMemo(
    () => (Array.isArray(mine) ? mine : EMPTY_ROWS) as LeaveRequestRow[],
    [mine]
  )

  // Filter navigation based on user permissions. Admins get the trimmed
  // ADMIN_NAV list; everyone else keeps the standard NAV order.
  const visibleNav = useMemo(
    () =>
      (isAdmin(profile) ? ADMIN_NAV : NAV).filter((item) => {
        if (item.admin) return isAdmin(profile)
        if (item.to === '/leave-requests') return canApprove(profile)
        return true
      }),
    [profile]
  )

  // Unread-notification badge: how many not-yet-read notices the user has.
  // Kept fresh on sign-in, on a light poll, and whenever the notifications
  // panel closes (opening it marks that batch read, see NotificationsPanel).
  const signedInId = profile?.id ?? null
  const unreadCall = useRef(0)

  const refreshUnread = useCallback(() => {
    const callId = ++unreadCall.current
    fetchMyNotifications().then(({ rows }) => {
      // Ignore superseded responses from a previous poll.
      if (callId === unreadCall.current) {
        setUnreadCount(rows.filter((row) => !row.read_at).length)
      }
    })
  }, [])

  useEffect(() => {
    if (!signedInId) {
      setUnreadCount(0)
      return
    }
    refreshUnread()
    // Near-realtime: short poll plus an instant refresh whenever the tab
    // becomes visible or the window regains focus.
    const timer = setInterval(refreshUnread, 10_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnread()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [signedInId, refreshUnread])

  const notifsOpenedOnce = useRef(false)
  useEffect(() => {
    if (notifsOpen) notifsOpenedOnce.current = true
    else if (notifsOpenedOnce.current) refreshUnread()
  }, [notifsOpen, refreshUnread])

  // The Admin console page is branded differently in the top bar.
  const location = useLocation()
  const onAdminConsole = isAdmin(profile) && location.pathname.startsWith('/admin')
  const headerTitle = onAdminConsole ? 'Admin Console' : 'Leave Management'

  // Keep the browser tab title in sync with the top bar.
  useEffect(() => {
    document.title = onAdminConsole ? 'Emids · Admin Console' : 'Emids · Leave Management'
  }, [onAdminConsole])

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
          onClick={() => goto(isAdmin(profile) ? '/admin' : '/dashboard')}
        >
          <img src={logo} alt="Emids" />
        </button>

        <div className="header__title">{headerTitle}</div>

        <div className="header__right">
          <IconButton
            label={searchOpen ? 'Hide search' : 'Show search'}
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            data-search-toggle=""
            className={`header__profile${searchOpen ? ' is-open' : ''}`}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <IconSearch size={21} />
          </IconButton>

          <IconButton
            label={
              notifsOpen
                ? 'Hide notifications'
                : unreadCount > 0
                  ? `Show notifications · ${unreadCount} unread`
                  : 'Show notifications'
            }
            aria-haspopup="dialog"
            aria-expanded={notifsOpen}
            data-notif-toggle=""
            className={`header__profile${notifsOpen ? ' is-open' : ''}`}
            onClick={() => setNotifsOpen((v) => !v)}
          >
            <IconBell size={21} />
            {unreadCount > 0 && (
              <span className="icon-btn__count" title={`${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </IconButton>

          <IconButton
            label={profileOpen ? 'Hide my profile' : 'Show my profile'}
            className={`header__profile${profileOpen ? ' is-open' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            data-profile-toggle=""
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
            onLogout={logout}
          />
        )}

        {notifsOpen && <NotificationsPanel onDismiss={() => setNotifsOpen(false)} />}

        {searchOpen && (
          <SearchPanel
            mine={mineRows}
            team={teamRows}
            searchEmployees={isAdmin(profile)}
            onDismiss={() => setSearchOpen(false)}
          />
        )}
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
