import { render, act, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'

// Same wholesale service mock as AuthContext.test.jsx, plus a mapping shaper
// that throws — the store's loader-throw path after a confirmed write.
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

// Mutation-success + refresh-failure: force the refresh to throw via the mapper
// (services never reject by design), which exercises the store's
// saved-but-not-refreshed handling.
vi.mock('../../../src/store/mappings', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    mapRow: () => {
      throw new Error('bad row')
    },
  }
})

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

beforeEach(() => {
  vi.clearAllMocks()
  authListeners.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('store/AuthContext — refresh failure after a confirmed write', () => {
  it('addMine confirms the write but lets the broken refresh reject (caller acts on the throw)', async () => {
    getAuthSession.mockResolvedValueOnce({ session: { user: { id: 'uid-1' } } })
    fetchProfileByAuthId.mockResolvedValueOnce({ profile: { id: 'e-me', full_name: 'Me' }, error: null, warning: null })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    insertMine.mockResolvedValueOnce({ requestNo: 'LV-9', error: null })
    // the post-insert refresh pulls one row into the throwing mapper
    fetchMine.mockResolvedValueOnce({ rows: [{}], error: null })

    let rejection: Error | null = null
    await act(async () => {
      try {
        await ctxOf(spy).addMine({
          type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-13', days: 2, mode: 'Full Day', reason: 'trip', requestedOn: '2026-10-12',
        })
      } catch (error) {
        rejection = error as Error
      }
    })
    // The write itself went through (the service confirmed LV-9) but the
    // post-insert refresh surfaces as a thrown error the caller can act on —
    // the store no longer returns the request number when the refresh broke.
    expect(insertMine).toHaveBeenCalledTimes(1)
    expect(rejection).toBeInstanceOf(Error)
    expect(rejection!.message).toBe('bad row')
  })
})
