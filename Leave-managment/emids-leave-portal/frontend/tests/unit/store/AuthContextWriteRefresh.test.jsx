import { render, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

// Mutation-success + refresh-failure: force the refresh to throw via the mapper
// (services never reject by design), which exercises the store's
// saved-but-not-refreshed handling.
vi.mock('../../../src/store/mappings', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    mapRow: () => {
      throw new Error('bad row')
    },
  }
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
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('store/AuthContext — refresh failure after a confirmed write', () => {
  it('addMine returns the request number and flags the stale list instead of failing', async () => {
    mockDb.setSession({ user: { id: 'uid-1' } })
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: { id: 'e-me' } })
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('employees', { eq: ['manager_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_balances', { eq: ['employee_id', 'e-me'], data: [] })
    mockDb.expectSelect('leave_types', { data: [] })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    mockDb.expectSelect('leave_types', { eq: ['name', 'Paid Time Off'], data: { id: 'lt-1' } })
    mockDb.expectInsert('leave_requests', { data: { request_no: 'LV-9' } })
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e-me'], data: [{}] })

    let requestNo
    await act(async () => {
      requestNo = await spy.current.addMine({
        type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-13', days: 2, mode: 'Full Day', reason: 'trip', requestedOn: '2026-10-12',
      })
    })
    // The insert was confirmed — the result stays truthful even though the refresh broke.
    expect(requestNo).toBe('LV-9')
    await waitCtx(spy, (ctx) => ctx.toast?.kind === 'red' && ctx.toast.msg === 'Request saved — the list could not refresh automatically.')
  })
})
