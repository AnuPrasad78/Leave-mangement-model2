// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, signSessionJwt } from '@/lib/session'
import { middleware } from '@/middleware'

let token = ''

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret'
  token = await signSessionJwt('uid-1')
})

function request(path: string, withCookie: boolean): NextRequest {
  const headers: Record<string, string> = withCookie ? { cookie: `${SESSION_COOKIE}=${token}` } : {}
  return new NextRequest(`http://localhost:3000${path}`, { headers })
}

describe('middleware — SSR gate', () => {
  it('redirects an unauthenticated user away from a protected route', async () => {
    const response = await middleware(request('/dashboard', false))
    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('redirects when the cookie is present but tampered', async () => {
    const tampered = new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: `${SESSION_COOKIE}=tampered-value` },
    })
    const response = await middleware(tampered)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login')
  })

  it('passes authenticated users through', async () => {
    const response = await middleware(request('/dashboard', true))
    expect(response).toBeInstanceOf(NextResponse)
    expect(response.headers.get('location')).toBeNull()
  })
})
