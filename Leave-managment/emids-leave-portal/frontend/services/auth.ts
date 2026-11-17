
import { apiRequest } from './apiClient'
import type { ApiError } from './apiClient'

export interface ApiSession {
  user: { id: string; email?: string }
}

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT'
type AuthCallback = (event: AuthEvent, session: ApiSession | null) => void

const AUTH_EVENT = 'leave-portal-auth-change'

function emitAuthEvent(
  event: AuthEvent,
  session: ApiSession | null
): void {
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, { detail: { event, session } })
  )
}

async function fetchSession(): Promise<ApiSession> {
  const profile = await apiRequest<{
    user_id: string
    email: string
  }>('/auth/me')

  return {
    user: {
      id: profile.user_id,
      email: profile.email,
    },
  }
}

export async function getSession(): Promise<{
  session: ApiSession | null
}> {
  try {
    const session = await fetchSession()
    return { session }
  } catch (error) {
    if (error instanceof Error && (error as ApiError).status === 401) {
      return { session: null }
    }

    throw error
  }
}

export function subscribeToAuth(
  callback: AuthCallback
): { unsubscribe: () => void } {
  const listener = (event: Event) => {
    const detail = (
      event as CustomEvent<{
        event: AuthEvent
        session: ApiSession | null
      }>
    ).detail

    callback(detail.event, detail.session)
  }

  window.addEventListener(AUTH_EVENT, listener)

  return {
    unsubscribe: () => window.removeEventListener(AUTH_EVENT, listener),
  }
}

export async function signInWithPassword(
  email: string,
  password: string
) {
  try {
    await apiRequest<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const session = await fetchSession()

    emitAuthEvent('SIGNED_IN', session)

    return { data: { session }, error: null }
  } catch (error) {
    return {
      data: { session: null },
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to sign in.',
      },
    }
  }
}

export async function signOut() {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
    })
  } catch (error) {
    // A 401 means the cookie was already absent or expired — the browser
    // session is over either way. Only real transport failures surface.
    if (!(error instanceof Error && (error as ApiError).status === 401)) {
      return {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Unable to sign out.',
        },
      }
    }
  }

  emitAuthEvent('SIGNED_OUT', null)

  return { error: null }
}
