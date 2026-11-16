import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, backendUrl, clearSessionCookies } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return clearSessionCookies(NextResponse.json({ detail: 'Authentication required' }, { status: 401 }))
  }
  const backend = await fetch(`${backendUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (backend.status === 401) {
    return clearSessionCookies(NextResponse.json({ detail: 'Authentication required' }, { status: 401 }))
  }
  const payload = await backend.text()
  return new NextResponse(payload, {
    status: backend.status,
    headers: { 'Content-Type': backend.headers.get('content-type') || 'application/json' },
  })
}
