import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, clearAccessToken, getAccessToken, resetApiClientMock, setAccessToken } from '../mocks/apiClient'
import { getSession, subscribeToAuth, signInWithPassword, signOut } from '../../../src/services/auth'

beforeEach(() => {
  resetApiClientMock()
  clearAccessToken()
  localStorage.clear()
})

describe('services/auth', () => {
  it('restores a session from the stored bearer token', async () => {
    setAccessToken('token-1')
    apiRequest.mockResolvedValueOnce({ user_id: 'uid-1', email: 'u@example.com' })
    const { session } = await getSession()
    expect(session?.user?.id).toBe('uid-1')
    expect(apiRequest).toHaveBeenCalledWith('/auth/me')
  })

  it('passes API sign-in errors through with their message', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Invalid email or password'), { status: 401 }))
    const { error } = await signInWithPassword('x@emids.com', 'wrong')
    expect(error.message).toBe('Invalid email or password')
  })

  it('stores a returned token and emits signed-in state', async () => {
    const callback = vi.fn()
    subscribeToAuth(callback)
    apiRequest.mockResolvedValueOnce({ access_token: 'token-1' }).mockResolvedValueOnce({ user_id: 'uid-1', email: 'x@emids.com' })
    const { data, error } = await signInWithPassword('x@emids.com', 'pw')
    expect(error).toBeNull()
    expect(data.session.user.id).toBe('uid-1')
    expect(getAccessToken()).toBe('token-1')
    expect(callback).toHaveBeenCalledWith('SIGNED_IN', { user: { id: 'uid-1', email: 'x@emids.com' } })
  })

  it('emits local auth state events on sign out', async () => {
    const cb = vi.fn()
    const subscription = subscribeToAuth(cb)
    await signOut()
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null)
    expect(typeof subscription.unsubscribe).toBe('function')
  })

  it('signs out through the API and clears the local token', async () => {
    setAccessToken('token-1')
    apiRequest.mockResolvedValueOnce({ ok: true })
    await expect(signOut()).resolves.toMatchObject({ error: null })
    expect(getAccessToken()).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
  })
})
