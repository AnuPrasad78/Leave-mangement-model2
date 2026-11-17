'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../store/AuthContext'
import { canApprove, isAdmin } from '../../../utils/roles'
import Layout from '../../components/organisms/Layout'

export interface SigninGuardProps {
  children: ReactNode
  /** 'manager' replicates ManagerOnly, 'admin' replicates AdminOnly; leaving it undefined replicates the plain Guard. */
  require?: 'manager' | 'admin'
}

/* Next.js port of the App.tsx guard family: null while the session restores,
 * replace to /login when signed out, and a role gate redirecting to the
 * dashboard. Renders children inside the existing Layout. */
export default function SigninGuard({ children, require: role }: SigninGuardProps) {
  const { signedIn, authReady, profile } = useAuth()
  const router = useRouter()

  const roleOk =
    !role || Boolean(profile && (role === 'manager' ? canApprove(profile) : isAdmin(profile)))

  useEffect(() => {
    if (!authReady) return
    if (!signedIn) {
      router.replace('/login')
      return
    }
    if (profile && !roleOk && role) {
      router.replace('/dashboard')
    }
  }, [authReady, signedIn, profile, roleOk, role, router])

  if (!authReady) return null
  if (!signedIn) return null
  if (!profile) return null
  if (role && !roleOk) return null

  return <Layout>{children}</Layout>
}
