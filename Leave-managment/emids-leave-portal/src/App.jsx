import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import Layout from './components/Layout'
import { Toast } from './components/UI'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ApplyLeave from './pages/ApplyLeave'
import LeaveDetails from './pages/LeaveDetails'
import LeaveRequests from './pages/LeaveRequests'
import Holidays from './pages/Holidays'
import SeparationRequest from './pages/SeparationRequest'

function Guard({ children }) {
  const { signedIn, authReady } = useAuth()
  const location = useLocation()
  if (!authReady) return null
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <>
      <Toast />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/apply-leave" element={<Guard><ApplyLeave /></Guard>} />
        <Route path="/leave-details" element={<Guard><LeaveDetails /></Guard>} />
        <Route path="/leave-requests" element={<Guard><LeaveRequests /></Guard>} />
        <Route path="/holidays" element={<Guard><Holidays /></Guard>} />
        <Route path="/separation-request" element={<Guard><SeparationRequest /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
