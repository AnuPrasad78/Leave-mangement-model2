import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { getSession, subscribeToAuth, signInWithPassword, signOut } from '../../../src/services/auth'

beforeEach(() => {
  resetApiClientMock()
  localStorage.clear()
})

describe('services/auth', () => {
  it('restores a session from the server-set cookie session', async () => {
    apiRequest.mockResolvedValueOnce({ user_id: 'uid-1', email: 'u@example.com' })
    const { session } = await getSession()
    expect(session?.user?.id).toBe('uid-1')
    expect(apiRequest).toHaveBeenCalledWith('/auth/me')
  })

  it('treats any /auth/me failure as no session', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Authentication required'), { status: 401 }))
    const { session } = await getSession()
    expect(session).toBeNull()
  })

  it('passes API sign-in errors through with their message', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Invalid login credentials'), { status: 401 }))
    const { error } = await signInWithPassword('x@emids.com', 'wrong')
    expect(error!.message).toBe('Invalid login credentials')
  })

  it('signs in through the BFF and never stores a token client-side, emitting signed-in state', async () => {
    const callback = vi.fn()
    subscribeToAuth(callback)
    apiRequest.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ user_id: 'uid-1', email: 'x@emids.com' })
    const { data, error } = await signInWithPassword('x@emids.com', 'pw')
    expect(error).toBeNull()
    expect(data.session!.user.id).toBe('uid-1')
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@emids.com', password: 'pw' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/auth/me')
    expect(document.cookie).not.toContain('lp_session') // session stays HttpOnly
    expect(callback).toHaveBeenCalledWith('SIGNED_IN', { user: { id: 'uid-1', email: 'x@emids.com' } })
  })

  it('emits local auth state events on sign out', async () => {
    const cb = vi.fn()
    const subscription = subscribeToAuth(cb)
    await signOut()
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null)
    expect(typeof subscription.unsubscribe).toBe('function')
  })

  it('signs out through the API unconditionally and emits signed-out even on failure', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    await expect(signOut()).resolves.toMatchObject({ error: null })
    expect(apiRequest).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })

    resetApiClientMock()
    const cb = vi.fn()
    subscribeToAuth(cb)
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch')))
    const result = await signOut()
    expect(result.error).toMatchObject({ message: 'Failed to fetch' })
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null)
  })
})
