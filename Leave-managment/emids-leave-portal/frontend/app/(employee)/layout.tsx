import type { ReactNode } from 'react'
import SigninGuard from '../lib/security/SigninGuard'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <SigninGuard>{children}</SigninGuard>
}
