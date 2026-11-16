import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, backendUrl, clearSessionCookies } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      await fetch(`${backendUrl()}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    } catch {
      // Best-effort: the backend keeps the JWT valid until expiry, but the cookie is gone either way.
    }
  }
  return clearSessionCookies(NextResponse.json({ ok: true }))
}
