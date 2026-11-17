export interface ApiError extends Error {
  status?: number
  code?: string | number
  headers?: Record<string, string>
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')


function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function buildTraceparent(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return null
  return `00-${randomHex(16)}-${randomHex(8)}-01`
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('traceparent')) {
    const traceparent = buildTraceparent()
    if (traceparent) headers.set('traceparent', traceparent)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
  ...init,
  headers,
  credentials: 'include',
})

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
