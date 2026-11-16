import { NextRequest, NextResponse } from 'next/server'
import { backendUrl, SESSION_COOKIE, clearSessionCookies, isCsrfOk, verifySessionJwt } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params
  const unsafe = request.method !== 'GET' && request.method !== 'HEAD'
  if (unsafe && !isCsrfOk(request)) {
    return NextResponse.json({ detail: 'CSRF check failed' }, { status: 403 })
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value
  const sub = await verifySessionJwt(sessionCookie)
  const headers = new Headers()
  const traceparent = request.headers.get('traceparent')
  if (traceparent) headers.set('traceparent', traceparent)
  if (unsafe) {
    const contentType = request.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
  }
  if (sessionCookie && sub) headers.set('Authorization', `Bearer ${sessionCookie}`)

  const url = new URL(request.url)
  const body = unsafe ? await request.arrayBuffer() : undefined
  const backendResponse = await fetch(`${backendUrl()}/${path.join('/')}${url.search}`, {
    method: request.method,
    headers,
    body,
  })

  if (backendResponse.status === 401 && sub) {
    const payload = await backendResponse.text()
    return clearSessionCookies(
      new NextResponse(payload, { status: 401, headers: { 'Content-Type': 'application/json' } })
    )
  }

  const responseHeaders = new Headers()
  const contentType = backendResponse.headers.get('content-type')
  if (contentType) responseHeaders.set('Content-Type', contentType)
  const payload = backendResponse.status === 204 ? null : await backendResponse.text()
  return new NextResponse(payload, { status: backendResponse.status, headers: responseHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
