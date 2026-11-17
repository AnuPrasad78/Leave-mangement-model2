'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/* React Router parity: the `*` wildcard rendered <Navigate to="/" replace />.
 * This catch-all only receives URLs no static route matches (static segments
 * always win), then sends the browser to / — which forwards to /login. */
export default function CatchAllPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return null
}
