'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/AuthContext'
import { canApprove } from '@/utils/roles'
import Layout from '@/components/Layout'

/* Managers and admins only — employees are redirected to the dashboard. */
export default function ManagerGuard({ children }: { children: ReactNode }) {
  const { signedIn, authReady, profile } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authReady) return
    if (!signedIn) router.replace('/login')
    else if (!profile) return
    else if (!canApprove(profile)) router.replace('/dashboard')
  }, [authReady, signedIn, profile, router])

  if (!authReady) return null
  if (!signedIn) return null
  if (!profile) return null
  if (!canApprove(profile)) return null

  return <Layout>{children}</Layout>
}
