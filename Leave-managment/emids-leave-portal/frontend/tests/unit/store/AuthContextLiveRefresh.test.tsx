import { render, act, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'

// Same wholesale service mock as AuthContext.test.jsx — this suite exercises
// the background (silent) refresh that keeps the bell current without a
// re-login, not transport details.
const getAuthSession: Mock = vi.fn(async () => ({ session: null }))
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

const fetchProfileByAuthId: Mock = vi.fn(async () => ({ profile: null, error: null, warning: null }))
const fetchReportIds: Mock = vi.fn(async () => ({ ids: [], error: null }))
vi.mock('../../../src/services/employees', () => ({
  fetchProfileByAuthId: (...args: unknown[]) => fetchProfileByAuthId(...args),
  fetchReportIds: (...args: unknown[]) => fetchReportIds(...args),
}))

const fetchMine: Mock = vi.fn(async () => ({ rows: [], error: null }))
const fetchTeam: Mock = vi.fn(async () => ({ rows: [], error: null }))
const insertMine: Mock = vi.fn((..._args: unknown[]) => undefined)
const updateMine: Mock = vi.fn((..._args: unknown[]) => undefined)
const cancelMine: Mock = vi.fn((..._args: unknown[]) => undefined)
const decide: Mock = vi.fn((..._args: unknown[]) => undefined)
const decideMany: Mock = vi.fn((..._args: unknown[]) => undefined)
vi.mock('../../../src/services/leaveRequests', () => ({
  fetchMine: (...args: unknown[]) => fetchMine(...args),
  fetchTeam: (...args: unknown[]) => fetchTeam(...args),
  insertMine: (...args: unknown[]) => insertMine(...args),
  updateMine: (...args: unknown[]) => updateMine(...args),
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

const fetchAllHolidays: Mock = vi.fn(async () => ({ rows: [], error: null }))
vi.mock('../../../src/services/holidays', () => ({
  fetchAllHolidays: (...args: unknown[]) => fetchAllHolidays(...args),
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
  getAuthSession.mockResolvedValueOnce({ session: { user: { id: 'uid-1' } } })
  fetchProfileByAuthId.mockResolvedValueOnce({ profile: { id: 'e-me', full_name: 'Me' }, error: null, warning: null })
  fetchReportIds.mockResolvedValue({ ids: ['r1'], error: null })
  fetchTeam.mockResolvedValue({ rows: [], error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  authListeners.length = 0
})

describe('store/AuthContext — silent live refresh', () => {
  it('re-pulls mine and team on the background poll interval while signed in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await gotoSignedIn()
      const spy = renderStore()
      await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
      const mineCallsAtSignIn = fetchMine.mock.calls.length
      const teamCallsAtSignIn = fetchTeam.mock.calls.length

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31000)
      })

      expect(fetchMine.mock.calls.length).toBeGreaterThan(mineCallsAtSignIn)
      expect(fetchMine).toHaveBeenLastCalledWith('e-me')
      expect(fetchTeam.mock.calls.length).toBeGreaterThan(teamCallsAtSignIn)
      expect(fetchTeam).toHaveBeenLastCalledWith(['r1'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes when the window regains focus', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
    const mineCallsAtSignIn = fetchMine.mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(fetchMine.mock.calls.length).toBeGreaterThan(mineCallsAtSignIn)
  })

  it('keeps poll errors silent — the store never toasts from the background tick', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await gotoSignedIn()
      const spy = renderStore()
      await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
      const mineCallsAtSignIn = fetchMine.mock.calls.length
      fetchMine.mockImplementation(async () => ({ rows: [], error: { code: 'network', userMessage: 'offline' } }))
      fetchTeam.mockImplementation(async () => ({ rows: [], error: { code: 'network', userMessage: 'offline' } }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31000)
      })

      expect(fetchMine.mock.calls.length).toBeGreaterThan(mineCallsAtSignIn)
      expect(ctxOf(spy).toast).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops polling after sign-out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await gotoSignedIn()
      const spy = renderStore()
      await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
      const mineCallsAtSignOut = fetchMine.mock.calls.length

      signOutSession.mockImplementationOnce(async () => {
        // mirror services/auth.signOut: the service itself emits SIGNED_OUT
        const callback = authListeners[authListeners.length - 1] as
          | ((event: string, session: null) => void)
          | undefined
        callback?.('SIGNED_OUT', null)
        return { error: null }
      })
      await act(async () => {
        await ctxOf(spy).signOut()
      })
      await waitCtx(spy, (ctx) => !ctx.signedIn)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31000)
      })

      expect(fetchMine.mock.calls.length).toBe(mineCallsAtSignOut)
    } finally {
      vi.useRealTimers()
    }
  })
})
