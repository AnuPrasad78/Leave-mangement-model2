// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  newCsrf,
  signSessionJwt,
  verifySessionJwt,
  setSessionCookies,
  clearSessionCookies,
  isCsrfOk,
} from '../../../src/lib/session'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret'
})

describe('lib/session', () => {
  it('round-trips a session JWT and rejects tampered tokens', async () => {
    const token = await signSessionJwt('uid-1')
    expect(await verifySessionJwt(token)).toBe('uid-1')
    const tampered = token.slice(0, -4) + '0000'
    await expect(verifySessionJwt(tampered)).resolves.toBeNull()
  })

  it('treats a missing token as no session', async () => {
    await expect(verifySessionJwt(undefined)).resolves.toBeNull()
  })

  it('generates a 64-hex-char CSRF token', () => {
    const csrf = newCsrf()
    expect(csrf).toMatch(/^[0-9a-f]{64}$/)
    expect(newCsrf()).not.toBe(csrf)
  })

  it('sets the session cookie HttpOnly and the csrf cookie readable', () => {
    const response = setSessionCookies(NextResponse.json({}), 'tok', newCsrf())
    const session = response.cookies.get(SESSION_COOKIE)
    expect(session?.httpOnly).toBe(true)
    expect(session?.value).toBe('tok')
    const csrf = response.cookies.get(CSRF_COOKIE)
    expect(csrf?.httpOnly).toBe(false)
  })

  it('clearing expires both cookies', () => {
    const response = clearSessionCookies(NextResponse.json({}))
    expect(response.cookies.get(SESSION_COOKIE)?.maxAge).toBe(0)
    expect(response.cookies.get(CSRF_COOKIE)?.maxAge).toBe(0)
  })

  it('enforces the double-submit CSRF check on cookie/header equality only', () => {
    const request = new NextRequest('http://localhost:3000/api/lead-requests', {
      method: 'POST',
      headers: { cookie: `${CSRF_COOKIE}=abcd1234`, 'x-csrf-token': 'abcd1234' },
    })
    expect(isCsrfOk(request)).toBe(true)

    const wrongHeader = new NextRequest('http://localhost:3000/api/lead-requests', {
      method: 'POST',
      headers: { cookie: `${CSRF_COOKIE}=abcd1234`, 'x-csrf-token': 'ffffffff' },
    })
    expect(isCsrfOk(wrongHeader)).toBe(false)

    const missingCookie = new NextRequest('http://localhost:3000/api/lead-requests', {
      method: 'POST',
      headers: { 'x-csrf-token': 'abcd1234' },
    })
    expect(isCsrfOk(missingCookie)).toBe(false)
  })
})
