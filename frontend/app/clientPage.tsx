'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

/* Pages read the HttpOnly-cookie session through /api/auth/me and fetch
 * same-origin during render, so nothing can be prerendered server-side —
 * render client-only, like the plain SPA this used to be. */
export function makeClientPage(loader: () => Promise<{ default: ComponentType }>) {
  const Page = dynamic(loader, { ssr: false, loading: () => null })
  return function ClientPage() {
    return <Page />
  }
}
