'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/AuthContext'
import Layout from '@/components/Layout'

/* Signed-in users only; everyone else is sent back to the login page. */
export default function PortalGuard({ children }: { children: ReactNode }) {
  const { signedIn, authReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (authReady && !signedIn) router.replace('/login')
  }, [authReady, signedIn, router])

  if (!authReady) return null
  if (!signedIn) return null

  return <Layout>{children}</Layout>
}
