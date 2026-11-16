import { NextRequest, NextResponse } from 'next/server'
import { backendUrl, newCsrf, setSessionCookies, verifySessionJwt } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid login credentials' }, { status: 400 })
  }
  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ detail: 'Invalid login credentials' }, { status: 401 })
  }

  const backend = await fetch(`${backendUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  })

  if (!backend.ok) {
    // Normalize the backend's login failure to the pinned UI wording contract.
    return NextResponse.json({ detail: 'Invalid login credentials' }, { status: 401 })
  }

  const { access_token: token } = (await backend.json()) as { access_token?: string }
  const sub = await verifySessionJwt(token)
  if (!token || !sub) {
    return NextResponse.json({ detail: 'Invalid login credentials' }, { status: 401 })
  }
  return setSessionCookies(NextResponse.json({ ok: true }), token, newCsrf())
}
