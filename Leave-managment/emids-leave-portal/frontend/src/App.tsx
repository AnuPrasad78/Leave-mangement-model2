import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './store/AuthContext'
import { AdminProvider } from './store/AdminContext'
import { canApprove, isAdmin } from './utils/roles'
import ErrorBoundary from './utils/ErrorBoundary'
import Layout from './components/Layout'
import { Toast } from './components/ui'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ApplyLeave from './pages/ApplyLeave'
import LeaveDetails from './pages/LeaveDetails'
import LeaveRequests from './pages/LeaveRequests'
import Holidays from './pages/Holidays'
import SeparationRequest from './pages/SeparationRequest'
import AdminDashboard from './pages/AdminDashboard'
import AdminEmployees from './pages/AdminEmployees'
import AdminLeavePolicies from './pages/AdminLeavePolicies'
import AdminAuditLogs from './pages/AdminAuditLogs'
import AdminReminders from './pages/AdminReminders'

interface GuardProps {
  children: ReactNode
}

function Guard({ children }: GuardProps) {
  const { signedIn, authReady } = useAuth()
  const location = useLocation()
  if (!authReady) return null
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout>{children}</Layout>
}

/* Managers and admins only — employees are redirected to the dashboard */
interface ManagerOnlyProps {
  children: ReactNode
}

function ManagerOnly({ children }: ManagerOnlyProps) {
  const { signedIn, authReady, profile } = useAuth()
  const location = useLocation()
  if (!authReady) return null
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) return null
  if (!canApprove(profile)) return <Navigate to="/dashboard" replace />
  return <Layout>{children}</Layout>
}

/* Admin persona only — managers and employees are redirected to the dashboard */
interface AdminOnlyProps {
  children: ReactNode
}

function AdminOnly({ children }: AdminOnlyProps) {
  const { signedIn, authReady, profile } = useAuth()
  const location = useLocation()
  if (!authReady) return null
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) return null
  if (!isAdmin(profile)) return <Navigate to="/dashboard" replace />
  return (
    <Layout>
      <AdminProvider>{children}</AdminProvider>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Toast />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/apply-leave" element={<Guard><ApplyLeave /></Guard>} />
        <Route path="/leave-details" element={<Guard><LeaveDetails /></Guard>} />
        <Route path="/leave-requests" element={<ManagerOnly><LeaveRequests /></ManagerOnly>} />
        <Route path="/holidays" element={<Guard><Holidays /></Guard>} />
        <Route path="/separation-request" element={<Guard><SeparationRequest /></Guard>} />

        <Route path="/admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
        <Route path="/admin/employees" element={<AdminOnly><AdminEmployees /></AdminOnly>} />
        <Route path="/admin/leave-policies" element={<AdminOnly><AdminLeavePolicies /></AdminOnly>} />
        <Route path="/admin/audit-logs" element={<AdminOnly><AdminAuditLogs /></AdminOnly>} />
        <Route path="/admin/reminders" element={<AdminOnly><AdminReminders /></AdminOnly>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
