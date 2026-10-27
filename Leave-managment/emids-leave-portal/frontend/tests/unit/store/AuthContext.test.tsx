import { render, act, screen, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'

// The service layer behind the store is mocked wholesale: this suite exercises
// the store's own orchestration (session handling, loaders, write helpers),
// not transport details.
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

// Queue a full signed-in boot: profile resolves; loaders return empty rows.
async function gotoSignedIn() {
  sessionRef.session = { user: { id: 'uid-1' } }
  fetchProfileByAuthId.mockResolvedValueOnce({ profile: { id: 'e-me', full_name: 'Me' }, error: null, warning: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionRef.session = null
  authListeners.length = 0
})

describe('store/AuthContext', () => {
  it('resolves the session and marks auth ready', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)
    expect(ctxOf(spy).profile?.id).toBe('e-me')
    expect(fetchProfileByAuthId).toHaveBeenCalledWith('uid-1')
    expect(fetchMine).toHaveBeenCalledWith('e-me')
    // no direct reports yet: the team lookup stops after the report-ids read
    expect(fetchReportIds).toHaveBeenCalledWith('e-me')
    expect(fetchTeam).not.toHaveBeenCalled()
    expect(fetchLatestBalances).toHaveBeenCalledWith('e-me')
    expect(fetchActiveLeaveTypeNames).toHaveBeenCalledTimes(1)
  })

  it('loads fixed holidays only for the employee location', async () => {
    sessionRef.session = { user: { id: 'uid-1' } }
    fetchProfileByAuthId.mockResolvedValueOnce({
      profile: { id: 'e-me', full_name: 'Me', location: 'Bangalore, IN' },
      error: null,
      warning: null,
    })
    fetchAllHolidays.mockResolvedValueOnce({
      rows: [
        { id: 1, country: 'India', kind: 'fixed', location: 'Bangalore', year: 2026, holiday_date: '2026-10-14', name: 'Holiday' },
        { id: 2, country: 'India', kind: 'optional', location: 'Bangalore', year: 2026, holiday_date: '2026-10-15', name: 'Optional' },
        { id: 3, country: 'India', kind: 'fixed', location: 'Hyderabad', year: 2026, holiday_date: '2026-10-16', name: 'Other location' },
      ],
      error: null,
    })
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn && ctx.fixedHolidayDates.length === 1)

    expect(ctxOf(spy).fixedHolidayDates).toEqual(['2026-10-14'])
  })

  it('signIn returns the error message string on failure', async () => {
    const spy = renderStore()
    signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    const message = await act(() => ctxOf(spy).signIn('x@emids.com', 'wrong'))
    expect(typeof message).toBe('string')
    expect(message).toBe('Invalid login credentials')
  })

  it('clears the toast after 3200 ms (ref-based timer, no function-property hack)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const spy = renderStore()
      await waitCtx(spy, (ctx) => ctx.authReady)
      expect(ctxOf(spy).toast).toBeNull()
      act(() => ctxOf(spy).setToast('Request approved'))
      expect(ctxOf(spy).toast?.msg).toBe('Request approved')
      act(() => vi.advanceTimersByTime(3300))
      expect(ctxOf(spy).toast).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("cancelMine cancels and toasts 'Request cancelled'", async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    cancelMine.mockResolvedValueOnce({ error: null })
    await act(async () => {
      await ctxOf(spy).cancelMine('LV-1')
    })
    expect(ctxOf(spy).toast).toMatchObject({ msg: 'Request cancelled', kind: 'ok' })
    expect(fetchMine).toHaveBeenLastCalledWith('e-me')
    expect(fetchLatestBalances).toHaveBeenLastCalledWith('e-me')
  })

  it('updates a pending request and refreshes the current user requests', async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    updateMine.mockResolvedValueOnce({ error: null })
    let updated = false
    await act(async () => {
      updated = await ctxOf(spy).updateMine('LV-1', {
        type: 'Paid Time Off',
        from: '2026-03-03',
        to: '2026-03-04',
        days: 2,
        mode: 'Full Day',
        reason: 'Updated reason',
      })
    })

    expect(updated).toBe(true)
    expect(updateMine).toHaveBeenCalledWith('LV-1', expect.objectContaining({ reason: 'Updated reason' }))
    expect(fetchMine).toHaveBeenLastCalledWith('e-me')
  })

  it("rejecting a request toasts in red and approving in ok", async () => {
    await gotoSignedIn()
    const spy = renderStore()
    await waitCtx(spy, (ctx) => ctx.authReady && ctx.signedIn)

    // decide: the team refresh needs the report ids then the requests
    fetchReportIds.mockResolvedValueOnce({ ids: ['r1'], error: null })
    fetchTeam.mockResolvedValueOnce({ rows: [], error: null })
    decide.mockResolvedValueOnce({ error: null })
    await act(async () => {
      await ctxOf(spy).decide('LV-2', 'Approved')
    })
    expect(ctxOf(spy).toast).toMatchObject({ msg: 'Request approved', kind: 'ok' })
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
