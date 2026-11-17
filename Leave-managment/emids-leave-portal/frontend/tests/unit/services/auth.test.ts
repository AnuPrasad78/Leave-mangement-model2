import { vi } from 'vitest'

vi.mock('../../../services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { getSession, subscribeToAuth, signInWithPassword, signOut } from '../../../services/auth'

beforeEach(() => {
  resetApiClientMock()
  localStorage.clear()
})

// The session lives in an HttpOnly cookie set by the backend on login.
// The frontend never stores the JWT itself; sign-in just triggers the
// cookie (POST /auth/login) and then re-reads the user via GET /auth/me.
describe('services/auth', () => {
  it('restores a session by probing /auth/me with cookie credentials', async () => {
    apiRequest.mockResolvedValueOnce({ user_id: 'uid-1', email: 'u@example.com' })
    const { session } = await getSession()
    expect(session?.user?.id).toBe('uid-1')
    expect(apiRequest).toHaveBeenCalledWith('/auth/me')
  })

  it('returns a null session when /auth/me answers 401 (no or expired cookie)', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Authentication required'), { status: 401 }))
    const { session } = await getSession()
    expect(session).toBeNull()
  })

  it('passes API sign-in errors through with their message', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Invalid email or password'), { status: 401 }))
    const { error } = await signInWithPassword('x@emids.com', 'wrong')
    expect(error!.message).toBe('Invalid email or password')
  })

  it('signs in through /auth/login, resolves the user via /auth/me and emits signed-in state', async () => {
    const callback = vi.fn()
    subscribeToAuth(callback)
    apiRequest
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ user_id: 'uid-1', email: 'x@emids.com' })
    const { data, error } = await signInWithPassword('x@emids.com', 'pw')
    expect(error).toBeNull()
    expect(data.session!.user.id).toBe('uid-1')
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@emids.com', password: 'pw' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/auth/me')
    // No token must be written anywhere by the client — sessions are cookie-side.
    expect(localStorage.length).toBe(0)
    expect(callback).toHaveBeenCalledWith('SIGNED_IN', { user: { id: 'uid-1', email: 'x@emids.com' } })
  })

  it('emits local auth state events on sign out', async () => {
    const cb = vi.fn()
    const subscription = subscribeToAuth(cb)
    await signOut()
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null)
    expect(typeof subscription.unsubscribe).toBe('function')
  })

  it('signs out through the API so the backend clears the HttpOnly cookie', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    await expect(signOut()).resolves.toMatchObject({ error: null })
    expect(apiRequest).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
  })

  it('treats a logout 401 (absent/expired cookie) as an already-ended session', async () => {
    const callback = vi.fn()
    subscribeToAuth(callback)
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Authentication required'), { status: 401 }))
    await expect(signOut()).resolves.toMatchObject({ error: null })
    expect(callback).toHaveBeenCalledWith('SIGNED_OUT', null)
  })
})
