import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import Assistant from './Assistant'
import {
  IconMenu, IconSearch, IconBell, IconX, IconLogout,
  IconDashboard, IconCalendarPlus, IconFileText, IconClipboardCheck, IconSun, IconDoor,
} from './Icons'

import logo from '../assets/emids-logo.svg'

const NAV = [
  { to: '/dashboard', num: '01', label: 'Dashboard', icon: IconDashboard },
  { to: '/apply-leave', num: '02', label: 'Apply Leave', icon: IconCalendarPlus },
  { to: '/leave-details', num: '03', label: 'My Requests', icon: IconFileText },
  { to: '/leave-requests', num: '04', label: 'Leave Requests', icon: IconClipboardCheck },
  { to: '/holidays', num: '05', label: 'Holiday Calendar', icon: IconSun },
  { to: '/separation-request', num: '06', label: 'Separation Request', icon: IconDoor },
]

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef(null)
  const { signOut, profile, notifications, unreadCount, loadNotifications, markRead, markAllRead } = useAuth()
  const navigate = useNavigate()

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  const goto = (to) => { navigate(to); setOpen(false) }
  const logout = () => { signOut(); setOpen(false); navigate('/login') }

  const toggleBell = () => {
    setBellOpen((o) => {
      if (!o) loadNotifications(profile?.id)
      return !o
    })
  }

  const openNotification = (n) => {
    markRead(n.id)
    setBellOpen(false)
    if (n.type === 'leave_submitted') navigate('/leave-requests', { state: { highlight: n.requestNo } })
    else navigate('/leave-details')
  }

  useEffect(() => {
    if (!bellOpen) return
    const onDown = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setBellOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [bellOpen])

  const timeAgo = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return 'just now'
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }

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
          <div className="bell-wrap" ref={bellRef}>
            <button
              className="icon-btn"
              aria-label="Notifications"
              title="Notifications"
              aria-expanded={bellOpen}
              onClick={toggleBell}
            >
              <IconBell size={21} />
              {unreadCount > 0 && (
                <span className="icon-btn__dot icon-btn__dot--count">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            {bellOpen && (
              <div className="notif-panel brand-frame">
                <div className="notif-panel__head">
                  <span className="eyebrow">Notifications</span>
                  <button
                    className="notif-panel__markall"
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="notif-panel__list">
                  {notifications.length === 0 && (
                    <div className="notif-panel__empty">No notifications yet.</div>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      className={`notif-item ${n.isRead ? 'is-read' : 'is-unread'}`}
                      onClick={() => openNotification(n)}
                    >
                      <span className="notif-item__dot" aria-hidden="true" />
                      <span className="notif-item__msg">{n.message}</span>
                      <span className="notif-item__time">{timeAgo(n.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content">{children}</main>

      <Assistant />

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

        <nav className="drawer__nav">
          {NAV.map(({ to, num, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span className="mono">{num}</span>
              {label}
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
    </div>
  )
}
