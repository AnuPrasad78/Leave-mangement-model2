export interface ApiError extends Error {
  status?: number
  code?: string | number
  headers?: Record<string, string>
}

/** Internal pub-sub event the AuthContext listens to; also dispatched on 401. */
export const AUTH_EVENT = 'leave-portal-auth-change'

function clearCsrfInBrowser(): void {
  if (typeof document === 'undefined') return
  document.cookie = 'lp_csrf=; Path=/; Max-Age=0; SameSite=Lax'
}

function emitSignedOut(): void {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { event: 'SIGNED_OUT', session: null } }))
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function buildTraceparent(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return null
  return `00-${randomHex(16)}-${randomHex(8)}-01`
}

function csrfHeader(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((entry) => entry.startsWith('lp_csrf='))
  return match ? decodeURIComponent(match.slice('lp_csrf='.length)) : null
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // Harmless on safe methods: the proxy only enforces the header for unsafe ones.
  const csrf = csrfHeader()
  if (csrf) headers.set('X-CSRF-Token', csrf)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('traceparent')) {
    const traceparent = buildTraceparent()
    if (traceparent) headers.set('traceparent', traceparent)
  }

  const response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
  if (response.status === 401) {
    clearCsrfInBrowser()
    emitSignedOut()
  }
  if (!response.ok) {
    let detail = 'Something went wrong. Please try again.'
    try {
      const body = (await response.json()) as { detail?: unknown; message?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
      else if (typeof body.message === 'string') detail = body.message
    } catch {
      detail = response.statusText || detail
    }
    const error = new Error(detail) as ApiError
    error.status = response.status
    error.code = response.status
    error.headers = Object.fromEntries(response.headers.entries())
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
