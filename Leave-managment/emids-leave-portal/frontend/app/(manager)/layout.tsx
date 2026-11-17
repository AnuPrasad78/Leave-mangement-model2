import type { ReactNode } from 'react'
import SigninGuard from '../lib/security/SigninGuard'

// Deliberately a separate route group from (portal): mounting this layout
// unmounts the employee-portal instance of Layout, preserving the React
// Router remount lifecycle for /dashboard <-> /leave-requests navigations.
export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <SigninGuard require="manager">{children}</SigninGuard>
}
