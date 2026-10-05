import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
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
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })

  const goto = (to) => { navigate(to); setOpen(false) }
  const logout = () => { signOut(); setOpen(false); navigate('/login') }

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
        </div>
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

        <nav className="drawer__nav">
          {NAV.map(({ to, num, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-item" onClick={() => setOpen(false)}>
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
