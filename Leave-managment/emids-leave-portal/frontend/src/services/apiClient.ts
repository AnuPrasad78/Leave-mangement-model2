export interface ApiError extends Error {
  status?: number
  code?: string | number
  headers?: Record<string, string>
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'leave-portal-access-token'

export function getAccessToken(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (response.status === 401) clearAccessToken()
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