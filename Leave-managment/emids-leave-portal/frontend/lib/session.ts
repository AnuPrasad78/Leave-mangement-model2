import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE = 'lp_session'
export const CSRF_COOKIE = 'lp_csrf'

/** Server-to-server base for the FastAPI backend (server-only env, never NEXT_PUBLIC). */
export function backendUrl(): string {
  return (process.env.API_INTERNAL_URL || 'http://localhost:8000').replace(/\/$/, '')
}

/** Must match the backend's JWT_SECRET or every session check fails. Server-only env. */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set on the Next.js server')
  return new TextEncoder().encode(secret)
}

const EXPIRY_MINUTES = Number(process.env.JWT_EXPIRY_MINUTES || '720')

export async function signSessionJwt(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${EXPIRY_MINUTES}m`)
    .sign(getJwtSecret())
}

export async function verifySessionJwt(token: string | undefined): Promise<string | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export function newCsrf(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const COOKIE_BASE = { path: '/', sameSite: 'lax' as const, secure: true }

export function setSessionCookies(response: NextResponse, sessionJwt: string, csrf: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, sessionJwt, { ...COOKIE_BASE, httpOnly: true, maxAge: EXPIRY_MINUTES * 60 })
  response.cookies.set(CSRF_COOKIE, csrf, { ...COOKIE_BASE, httpOnly: false, maxAge: EXPIRY_MINUTES * 60 })
  return response
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', { ...COOKIE_BASE, httpOnly: true, maxAge: 0 })
  response.cookies.set(CSRF_COOKIE, '', { ...COOKIE_BASE, httpOnly: false, maxAge: 0 })
  return response
}

function readCookie(request: NextRequest, name: string): string | undefined {
  return request.cookies.get(name)?.value
}

/** Double-submit CSRF check: for unsafe methods the X-CSRF-Token header must equal the lp_csrf cookie. */
export function isCsrfOk(request: NextRequest): boolean {
  const cookie = readCookie(request, CSRF_COOKIE)
  const header = request.headers.get('x-csrf-token')
  if (!cookie || !header) return false
  if (cookie.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < cookie.length; i++) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}
