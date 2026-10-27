import { render, act, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'

// Same wholesale service mock as AuthContext.test.jsx: contracts here are about
// the store's failure hardening, exercised at the service seam.
const sessionRef: { session: unknown } = { session: null }
const getAuthSession: Mock = vi.fn(async () => ({ session: sessionRef.session as never }))
const authListeners: unknown[] = []
const signInWithPassword: Mock = vi.fn((..._args: unknown[]) => undefined)
const signOutSession: Mock = vi.fn((..._args: unknown[]) => undefined)

vi.mock('../../../src/services/auth', () => ({
  getSession: (...args: unknown[]) => getAuthSession(...args),
  subscribeToAuth: vi.fn((callback) => {
    authListeners.push(callback)
    return { unsubscribe: () => authListeners.splice(authListeners.indexOf(callback), 1) }
  }),
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
  signOut: (...args: unknown[]) => signOutSession(...args),
}))

const fetchProfileByAuthId: Mock = vi.fn(async () => ({ profile: null, error: { code: 'unknown', userMessage: 'profile lookup failed' }, warning: null }))
const fetchReportIds: Mock = vi.fn(async () => ({ ids: [], error: null }))
vi.mock('../../../src/services/employees', () => ({
  fetchProfileByAuthId: (...args: unknown[]) => fetchProfileByAuthId(...args),
  fetchReportIds: (...args: unknown[]) => fetchReportIds(...args),
}))

const fetchMine: Mock = vi.fn(async () => ({ rows: [], error: null }))
const fetchTeam: Mock = vi.fn(async () => ({ rows: [], error: null }))
const insertMine: Mock = vi.fn((..._args: unknown[]) => undefined)
const cancelMine: Mock = vi.fn((..._args: unknown[]) => undefined)
const decide: Mock = vi.fn((..._args: unknown[]) => undefined)
const decideMany: Mock = vi.fn((..._args: unknown[]) => undefined)
vi.mock('../../../src/services/leaveRequests', () => ({
  fetchMine: (...args: unknown[]) => fetchMine(...args),
  fetchTeam: (...args: unknown[]) => fetchTeam(...args),
  insertMine: (...args: unknown[]) => insertMine(...args),
  cancelMine: (...args: unknown[]) => cancelMine(...args),
  decide: (...args: unknown[]) => decide(...args),
  decideMany: (...args: unknown[]) => decideMany(...args),
}))

const fetchLatestBalances: Mock = vi.fn(async () => ({ row: null, error: null }))
vi.mock('../../../src/services/balances', () => ({
  fetchLatestBalances: (...args: unknown[]) => fetchLatestBalances(...args),
}))

const fetchActiveLeaveTypeNames: Mock = vi.fn(async () => ({ names: [], error: null }))
vi.mock('../../../src/services/leaveTypes', () => ({
  fetchActiveLeaveTypeNames: (...args: unknown[]) => fetchActiveLeaveTypeNames(...args),
}))

vi.mock('../../../src/services/holidays', () => ({
  fetchAllHolidays: vi.fn(async () => ({ rows: [], error: null })),
}))

import { AuthProvider, useAuth } from '../../../src/store/AuthContext'
import type { AuthContextValue } from '../../../src/store/AuthContext'

function ctxOf(spy: { current: AuthContextValue | null }): AuthContextValue {
  if (!spy.current) throw new Error('no context yet')
  return spy.current
}

function Consumer({ spy }: { spy: { current: AuthContextValue | null } }) {
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
      if (!ctxOf(spy)) throw new Error('no ctx yet')
      if (!predicate(ctxOf(spy))) throw new Error('predicate not met yet')
    },
    { timeout: 3000, interval: 10 }
  )
}

async function gotoSignedIn() {
  sessionRef.session = { user: { id: 'uid-1' } }
  fetchProfileByAuthId.mockResolvedValueOnce({ profile: { id: 'e-me', full_name: 'Me' }, error: null, warning: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionRef.session = null
  authListeners.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('store/AuthContext — failure hardening', () => {
  it('resolves authReady even when getSession rejects', async () => {
    getAuthSession.mockRejectedValue(new TypeError('Failed to fetch'))
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady)
    expect(ctxOf(spy).signedIn).toBe(false)
    expect(ctxOf(spy).toast).toMatchObject({ kind: 'red', msg: 'Failed to fetch' })
  })

  it('a failing loader does not block the unrelated loaders', async () => {
    await gotoSignedIn()
    fetchMine.mockResolvedValueOnce({ rows: [], error: { code: 'unknown', userMessage: 'my queue broke' } })
    fetchActiveLeaveTypeNames.mockResolvedValueOnce({ names: ['Paid Time Off'], error: null })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
    expect(ctxOf(spy).leaveTypes).toEqual(['Paid Time Off'])
    expect(ctxOf(spy).mine).toEqual([])
    expect(ctxOf(spy).toast).toMatchObject({ kind: 'red', msg: 'my queue broke' })
  })

  it('a failed profile load for a later subscription user stays signed in and ready', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    // Later subscription event for a NEW user whose profile read fails:
    // handleSession must neither reject nor clobber readiness.
    fetchProfileByAuthId.mockResolvedValueOnce({
      profile: null,
      error: { code: 'unknown', userMessage: 'profile lookup failed' },
      warning: null,
    })
    act(() => {
      authListeners.forEach((cb) => (cb as (event: string, session: unknown) => void)('SIGNED_IN', { user: { id: 'uid-2' } }))
    })
    await waitCtx(spy, (ctx) => ctx.signedIn && ctx.profile === null)
    expect(ctxOf(spy).authReady).toBe(true)
    expect(ctxOf(spy).toast).toMatchObject({ kind: 'red', msg: 'profile lookup failed' })
  })

  it('addMine surfaces the API rejection message and never refreshes the list', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    insertMine.mockResolvedValueOnce({
      requestNo: null,
      error: { code: 404, userMessage: 'Unknown or inactive leave type' },
    })
    await act(async () => {
      const requestNo = await ctxOf(spy).addMine({
        type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-13', days: 2, mode: 'Full Day', reason: 'trip', requestedOn: '2026-10-12',
      })
      expect(requestNo).toBeNull()
    })
    // The mutation failed in-band — no refetch follows, no throw (outcome known).
    expect(fetchMine).toHaveBeenCalledTimes(1)
    expect(ctxOf(spy).toast).toMatchObject({ kind: 'red', msg: 'Unknown or inactive leave type' })
  })

  it('sign-out surfaces the client failure without crashing', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn && ctx.profile?.id === 'e-me')

    signOutSession.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    let ok = true
    await act(async () => {
      ok = await ctxOf(spy).signOut()
    })
    expect(ok).toBe(false)
    expect(ctxOf(spy).toast).toMatchObject({ kind: 'red', msg: 'Failed to fetch' })
  })

  it('SIGNED_OUT clears the full local state including leaveTypes', async () => {
    await gotoSignedIn()
    fetchActiveLeaveTypeNames.mockResolvedValueOnce({ names: ['Paid Time Off'], error: null })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn && ctx.leaveTypes.length === 1)

    act(() => {
      authListeners.forEach((cb) => (cb as (event: string, session: unknown) => void)('SIGNED_OUT', null))
    })
    await waitCtx(spy, (ctx) => !ctx.signedIn)
    expect(ctxOf(spy).profile).toBeNull()
    expect(ctxOf(spy).leaveTypes).toEqual([])
    expect(ctxOf(spy).balances).toBeNull()
  })
})
