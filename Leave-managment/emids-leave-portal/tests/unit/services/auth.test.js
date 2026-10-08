import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { getSession, subscribeToAuth, signInWithPassword, signOut } from '../../../src/services/auth'

beforeEach(() => {
  mockDb.reset()
  mockDb.setSession(null)
  mockDb.setSignInResult({ error: { message: 'Invalid login credentials', code: 400 } })
})

describe('services/auth', () => {
  it('returns the stored session', async () => {
    mockDb.setSession({ user: { id: 'uid-1' } })
    const { session } = await getSession()
    expect(session?.user?.id).toBe('uid-1')
  })

  it('passes sign-in errors through with the raw message (Login wording contract)', async () => {
    const { error } = await signInWithPassword('x@emids.com', 'wrong')
    expect(error.message).toBe('Invalid login credentials')
  })

  it('subscribes to auth state events', () => {
    const cb = vi.fn()
    const subscription = subscribeToAuth(cb)
    mockDb.emitAuthEvent('SIGNED_OUT', null)
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null)
    expect(typeof subscription.unsubscribe).toBe('function')
  })

  it('signs out through the client', async () => {
    await expect(signOut()).resolves.toBeUndefined()
  })
})
