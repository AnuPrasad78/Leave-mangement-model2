'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/* React Router parity: `/` rendered <Navigate to="/login" replace />.
 * Client-side replace keeps the same history behavior (no back-entry to /). */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return null
}
