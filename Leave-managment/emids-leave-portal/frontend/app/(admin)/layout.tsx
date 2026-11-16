'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/AuthContext'
import { AdminProvider } from '@/store/AdminContext'
import { isAdmin } from '@/utils/roles'
import Layout from '@/components/Layout'

/* Admin persona only — managers and employees are redirected to the dashboard. */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const { signedIn, authReady, profile } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authReady) return
    if (!signedIn) router.replace('/login')
    else if (!profile) return
    else if (!isAdmin(profile)) router.replace('/dashboard')
  }, [authReady, signedIn, profile, router])

  if (!authReady) return null
  if (!signedIn) return null
  if (!profile) return null
  if (!isAdmin(profile)) return null

  return (
    <Layout>
      <AdminProvider>{children}</AdminProvider>
    </Layout>
  )
}
