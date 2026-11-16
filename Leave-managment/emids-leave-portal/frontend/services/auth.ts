import { apiRequest, AUTH_EVENT } from './apiClient'

export interface ApiSession {
  user: { id: string; email?: string }
}

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT'
type AuthCallback = (event: AuthEvent, session: ApiSession | null) => void

function emitAuthEvent(event: AuthEvent, session: ApiSession | null): void {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { event, session } }))
}

export async function getSession(): Promise<{ session: ApiSession | null }> {
  try {
    const profile = await apiRequest<{ user_id: string; email: string }>('/auth/me')
    return { session: { user: { id: profile.user_id, email: profile.email } } }
  } catch {
    return { session: null }
  }
}

export function subscribeToAuth(callback: AuthCallback): { unsubscribe: () => void } {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ event: AuthEvent; session: ApiSession | null }>).detail
    callback(detail.event, detail.session)
  }
  window.addEventListener(AUTH_EVENT, listener)
  return { unsubscribe: () => window.removeEventListener(AUTH_EVENT, listener) }
}

export async function signInWithPassword(email: string, password: string) {
  try {
    await apiRequest<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const profile = await apiRequest<{ user_id: string; email: string }>('/auth/me')
    const session = { user: { id: profile.user_id, email: profile.email } }
    emitAuthEvent('SIGNED_IN', session)
    return { data: { session }, error: null }
  } catch (error) {
    return { data: { session: null }, error: { message: error instanceof Error ? error.message : 'Unable to sign in.' } }
  }
}

export async function signOut() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
    return { error: null }
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Unable to sign out.' } }
  } finally {
    emitAuthEvent('SIGNED_OUT', null)
  }
}
