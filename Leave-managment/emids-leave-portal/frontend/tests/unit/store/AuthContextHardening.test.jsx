import { render, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { AuthProvider, useAuth } from '../../../src/store/AuthContext'
import { mockDb } from '../mocks/supabase'
import { TRANSPORT_USER_MESSAGE } from '../../../src/services/errors'

function Consumer({ spy }) {
  const ctx = useAuth()
  spy.current = ctx
  return null
}

function renderStore() {
  const spy = { current: null }
  render(
    <AuthProvider>
      <Consumer spy={spy} />
    </AuthProvider>
  )
  return spy
}

async function waitCtx(spy, predicate) {
  await waitFor(
    () => {
      if (!spy.current) throw new Error('no ctx yet')
      if (!predicate(spy.current)) throw new Error('predicate not met yet')
    },
    { timeout: 3000, interval: 10 }
  )
}

function queueSignedIn(expects) {
  mockDb.setSession({ user: { id: 'uid-1' } })
  mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: { id: 'e-me' } })
  expects()
}

beforeEach(() => {
  mockDb.reset()
  mockDb.setSession(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('store/AuthContext — failure hardening', () => {
  it('resolves authReady even when getSession rejects', async () => {
    vi.spyOn(mockDb.auth, 'getSession').mockRejectedValue(new TypeError('Failed to fetch'))
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady)
    expect(spy.current.signedIn).toBe(false)
    expect(spy.current.toast).toMatchObject({ kind: 'red', msg: TRANSPORT_USER_MESSAGE })
  })

  it('a failing loader does not block the unrelated loaders', async () => {
    queueSignedIn(() => {
      mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], error: { message: 'my queue broke', code: '23514' } })
      mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_types', { data: [{ name: 'Paid Time Off' }] })
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
    expect(mockDb.calls.map((c) => c.table)).toContain('leave_types')
    expect(spy.current.leaveTypes).toEqual(['Paid Time Off'])
    expect(spy.current.mine).toEqual([])
    expect(spy.current.toast).toMatchObject({ kind: 'red', msg: 'my queue broke' })
  })

  it('a rejecting profile load stays signed in and readiness is untouched', async () => {
    queueSignedIn(() => {
      mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_types', { data: [] })
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    // Later subscription event for a NEW user with nothing queued: the profile
    // load resolves with the mock's in-band unqueued error — handleSession must
    // neither reject nor clobber readiness.
    act(() => {
      mockDb.emitAuthEvent('SIGNED_IN', { user: { id: 'uid-2' } })
    })
    await waitCtx(spy, (ctx) => ctx.signedIn && ctx.profile === null)
    expect(spy.current.authReady).toBe(true)
    expect(spy.current.toast).toMatchObject({ kind: 'red', msg: expect.stringContaining('[mock] no queued response') })
  })

  it('addMine reports a failed leave-type lookup and never attempts the insert', async () => {
    queueSignedIn(() => {
      mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_types', { data: [] })
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    mockDb.expectSelect('leave_types', { eq: ['name', 'Paid Time Off'], error: { message: 'permission denied', code: '42501' } })
    await act(async () => {
      const requestNo = await spy.current.addMine({
        type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-13', days: 2, mode: 'Full Day', reason: 'trip', requestedOn: '2026-10-12',
      })
      expect(requestNo).toBeNull()
    })
    expect(mockDb.calls.filter((c) => c.kind === 'insert')).toHaveLength(0)
    // The pre-existing contract: an unresolvable leave type surfaces the
    // 'Unknown leave type' wording, whether the cause is bad input or a lookup error.
    expect(spy.current.toast).toMatchObject({ kind: 'red', msg: 'Unknown leave type: Paid Time Off' })
  })

  it('sign-out clears local state even when the client call rejects', async () => {
    queueSignedIn(() => {
      mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_types', { data: [] })
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn && ctx.profile?.id === 'e-me')

    vi.spyOn(mockDb.auth, 'signOut').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => {
      await spy.current.signOut()
    })
    await waitCtx(spy, (ctx) => !ctx.signedIn && ctx.profile === null)
    expect(spy.current.toast).toMatchObject({ kind: 'red', msg: expect.stringContaining('Sign-out') })
  })

  it('SIGNED_OUT clears the full local state including leaveTypes', async () => {
    queueSignedIn(() => {
      mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
      mockDb.expectSelect('leave_types', { data: [{ name: 'Paid Time Off' }] })
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn && ctx.leaveTypes.length === 1)

    act(() => {
      mockDb.emitAuthEvent('SIGNED_OUT', null)
    })
    await waitCtx(spy, (ctx) => !ctx.signedIn)
    expect(spy.current.profile).toBeNull()
    expect(spy.current.leaveTypes).toEqual([])
    expect(spy.current.balances).toBeNull()
  })
})
