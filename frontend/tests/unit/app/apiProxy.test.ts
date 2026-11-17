// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, CSRF_COOKIE, signSessionJwt } from '@/lib/session'

type Handler = (request: NextRequest, ctx: { params: { path: string[] } }) => Promise<Response>

let cookieHeader = ''
let GET: Handler = () => Promise.resolve(new Response())
let POST: Handler = () => Promise.resolve(new Response())

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret'
  process.env.API_INTERNAL_URL = 'http://backend.test'
  const route = await import('../../../app/api/[...path]/route')
  GET = route.GET as unknown as Handler
  POST = route.POST as unknown as Handler
  cookieHeader = `${SESSION_COOKIE}=${await signSessionJwt('uid-1')}; ${CSRF_COOKIE}=csrf-token`
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new NextResponse(JSON.stringify({ data: 1 }), { status: 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function request(
  path: string,
  method = 'GET',
  opts: Partial<{ body: string; csrf: string; noSession: boolean }> = {}
): NextRequest {
  const headers: Record<string, string> = {}
  if (!opts.noSession) headers.cookie = cookieHeader
  if (opts.csrf !== undefined) headers['x-csrf-token'] = opts.csrf
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(`http://localhost:3000/api${path}`, { method, headers, body: opts.body })
}

function fetchCalls(): Array<[string, { headers: Headers; method?: string; body?: ArrayBuffer }]> {
  return (globalThis.fetch as unknown as { mock: { calls: Array<[string, { headers: Headers; method?: string; body?: ArrayBuffer }]> } })
    .mock.calls
}

describe('app/api/[...path] — BFF proxy', () => {
  it('forwards GET calls with the bearer token attached and passes status/JSON through', async () => {
    const response = await GET(request('/leave-requests?mine=true'), { params: { path: ['leave-requests'] } })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { data: number }).data).toBe(1)
    const [url, init] = fetchCalls()[0]
    expect(url).toBe('http://backend.test/leave-requests?mine=true')
    expect(init.headers.get('authorization')).toMatch(/^Bearer ey/)
  })

  it('rejects unsafe calls without a CSRF header', async () => {
    const response = await POST(request('/leave-requests', 'POST', { body: '{}', csrf: '' }), {
      params: { path: ['leave-requests'] },
    })
    expect(response.status).toBe(403)
    expect(fetchCalls()).toHaveLength(0)
  })

  it('rejects unsafe calls whose CSRF header mismatches the cookie', async () => {
    const response = await POST(request('/leave-requests/1/decision', 'POST', { body: '{}', csrf: 'wrong-token' }), {
      params: { path: ['leave-requests', '1', 'decision'] },
    })
    expect(response.status).toBe(403)
    expect(fetchCalls()).toHaveLength(0)
  })

  it('allows unsafe calls with a matching CSRF header, forwarding body and content type', async () => {
    const response = await POST(
      request('/leave-requests/LV-1/cancel', 'POST', { body: '{"status":"Cancelled"}', csrf: 'csrf-token' }),
      { params: { path: ['leave-requests', 'LV-1', 'cancel'] } }
    )
    expect(response.status).toBe(200)
    const [url, init] = fetchCalls()[0]
    expect(url).toBe('http://backend.test/leave-requests/LV-1/cancel')
    expect(init.method).toBe('POST')
    expect(JSON.parse(new TextDecoder().decode(init.body))).toEqual({ status: 'Cancelled' })
    expect(init.headers.get('content-type')).toBe('application/json')
    expect(init.headers.get('authorization')).toMatch(/^Bearer ey/)
  })

  it('does not attach a bearer header when the session cookie is missing', async () => {
    await GET(request('/auth/me', 'GET', { noSession: true }), { params: { path: ['auth', 'me'] } })
    expect(fetchCalls()[0][1].headers.get('authorization')).toBeNull()
  })

  it('clears the session cookies when the backend answers 401 with a valid cookie present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new NextResponse(JSON.stringify({}), { status: 401 })))
    const response = await GET(request('/leave-requests'), { params: { path: ['leave-requests'] } })
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie') ?? '').toContain('Max-Age=0')
  })
})
