'use client'

import type { ReactNode } from 'react'
import SigninGuard from '../lib/security/SigninGuard'
import { AdminProvider } from '../../store/AdminContext'

/* Signature hierarchy of AdminOnly (src/App.tsx): guard → Layout (rendered by
 * the guard) → AdminProvider → page. The group keeps one Layout + AdminProvider
 * instance across all five admin pages and drops both when leaving /admin/*. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SigninGuard require="admin">
      <AdminProvider>{children}</AdminProvider>
    </SigninGuard>
  )
}
