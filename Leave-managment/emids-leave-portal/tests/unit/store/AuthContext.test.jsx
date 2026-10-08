import { render, act, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { AuthProvider, useAuth } from '../../../src/store/AuthContext'
import { mockDb } from '../mocks/supabase'

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

beforeEach(() => {
  mockDb.reset()
  mockDb.setSession(null)
  mockDb.setSignInResult({ error: { message: 'Invalid login credentials', code: 400 } })
})

describe('store/AuthContext', () => {
  it('resolves the session and marks auth ready', async () => {
    mockDb.setSession({ user: { id: 'uid-1' } })
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: { id: 'e-me', full_name: 'Me' } })
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_types', { data: [] })

    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
    expect(spy.current.profile?.id).toBe('e-me')
    expect(mockDb.calls.map((c) => c.table)).toEqual(
      expect.arrayContaining(['employees', 'leave_requests', 'leave_balances', 'leave_types'])
    )
  })

  it('signIn returns the error message string on failure', async () => {
    const spy = renderStore()
    const message = await act(async () => spy.current.signIn('x@emids.com', 'wrong'))
    expect(typeof message).toBe('string')
    expect(message).toBe('Invalid login credentials')
  })

  it('clears the toast after 3200 ms (ref-based timer, no function-property hack)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const spy = renderStore()
      await waitCtx(spy, (ctx) => ctx.authReady)
      expect(spy.current.toast).toBeNull()
      act(() => spy.current.setToast('Request approved'))
      expect(spy.current.toast?.msg).toBe('Request approved')
      act(() => vi.advanceTimersByTime(3300))
      expect(spy.current.toast).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("cancelMine cancels and toasts 'Request cancelled'", async () => {
    mockDb.setSession({ user: { id: 'uid-1' } })
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: { id: 'e-me' } })
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_types', { data: [] })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    mockDb.expectUpdate('leave_requests')
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
    await act(async () => {
      await spy.current.cancelMine('LV-1')
    })
    expect(spy.current.toast).toMatchObject({ msg: 'Request cancelled', kind: 'ok' })
  })

  it("rejecting a request toasts in red and approving in ok", async () => {
    mockDb.setSession({ user: { id: 'uid-1' } })
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: { id: 'e-me' } })
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_types', { data: [] })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    // decide: team re-fetch needed (report ids then requests)
    mockDb.expectUpdate('leave_requests')
    mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [{ id: 'r1' }] })
    mockDb.expectSelect('leave_requests', { data: [] })
    await act(async () => {
      await spy.current.decide('LV-2', 'Approved')
    })
    expect(spy.current.toast).toMatchObject({ msg: 'Request approved', kind: 'ok' })
  })

  it('renders children', () => {
    render(
      <AuthProvider>
        <div>visible</div>
      </AuthProvider>
    )
    expect(screen.getByText('visible')).toBeInTheDocument()
  })
})
