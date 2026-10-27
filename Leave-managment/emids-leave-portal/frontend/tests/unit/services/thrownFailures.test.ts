import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock, setAccessToken, getAccessToken } from '../mocks/apiClient'
import { fetchMine, insertMine } from '../../../src/services/leaveRequests'
import { fetchLatestBalances } from '../../../src/services/balances'
import { fetchProfileByAuthId, fetchReportIds } from '../../../src/services/employees'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../../../src/services/leaveTypes'
import { fetchAllHolidays, fetchOptionalPicks, addOptionalPick, removeOptionalPick } from '../../../src/services/holidays'
import { createSeparationRequest } from '../../../src/services/separations'
import { signInWithPassword, signOut } from '../../../src/services/auth'

// Route every apiRequest call through a throwing path so the service
// exercises its thrown-transport normalization, not just in-band errors.
function breakTransport(fn: (...args: unknown[]) => never) {
  return apiRequest.mockImplementation((...args) => fn(...args))
}

const transportThrow = () => {
  throw Object.assign(new Error('Failed to fetch'))
}

beforeEach(() => resetApiClientMock())
afterEach(() => vi.restoreAllMocks())

describe('services — thrown transport failures keep the normalized contract', () => {
  it('read services retry a transient throw (bounded) then surface the transport wording', async () => {
    vi.useFakeTimers()
    try {
      const cases = [
        () => fetchMine('e1'),
        () => fetchLatestBalances('e1'),
        () => fetchReportIds('m1'),
        () => fetchActiveLeaveTypeNames(),
        () => fetchLeaveTypeIdByName('Paid Time Off'),
        () => fetchAllHolidays(),
        () => fetchOptionalPicks('e1'),
      ]
      for (const run of cases) {
        const spy = breakTransport(transportThrow)
        spy.mockClear()
        const pending = run()
        await vi.advanceTimersByTimeAsync(10000)
        const result = await pending
        expect(result.error).toMatchObject({ code: 'unknown', userMessage: 'Failed to fetch' })
        expect(spy).toHaveBeenCalledTimes(3) // bounded: 1 attempt + 2 retries
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('mutation services normalize a thrown transport failure as outcome-unknown without retrying', async () => {
    const spy = breakTransport(transportThrow)
    const results = [
      await insertMine({ type: 'Paid Time Off', from: '2026-03-02', to: '2026-03-06', days: 5, mode: 'Full Day', reason: 'x', requestedOn: '2026-02-20' }),
      await addOptionalPick('e1', 9),
      await removeOptionalPick('e1', 9),
      await createSeparationRequest({ employee_id: 'e1', last_working_day: '2099-01-01', reason: 'Other', remarks: null }),
    ]
    for (const result of results) {
      expect(result.error!.outcomeUnknown).toBe(true)
      expect(result.error!.userMessage).toContain('Failed to fetch')
      expect(result.error!.userMessage).toContain('The operation may have completed.')
    }
    expect(spy).toHaveBeenCalledTimes(4) // one attempt each, no retries
  })

  it('an aborted request normalizes to the transport wording without retrying', async () => {
    const spy = breakTransport(() => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    })
    const { error } = await fetchMine('e1')
    expect(error).toMatchObject({ userMessage: 'The operation was aborted' })
    expect(error!.code).toBe('unknown')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('signInWithPassword folds a thrown transport failure into its raw error shape', async () => {
    breakTransport(transportThrow)
    const { data, error } = await signInWithPassword('x@emids.com', 'pw')
    expect(data.session).toBeNull()
    expect(error!.message).toBe('Failed to fetch')
    expect(apiRequest).toHaveBeenCalledTimes(1) // login is never retried
  })

  it('in-band non-transient wording still passes through untouched', async () => {
    // An in-band HTTP error body (service threw with its own wording, not a transport throw)
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('not enough balance'), { status: 409 }))
    const { error } =
      await insertMine({ type: 'PTO', from: '2026-03-02', to: '2026-03-02', days: 1, mode: 'Full Day', reason: 'x', requestedOn: '2026-02-20' })
    expect(error!.userMessage).toContain('not enough balance')
    expect(error!.code).toBe(409)
  })

  it('profile lookup maps the /employees/me row in a single transport call', async () => {
    apiRequest.mockResolvedValueOnce({ id: 'fp1', full_name: 'Sai Nithin Reddy', manager_id: 'mgr-1' })
    const { profile, error, warning } = await fetchProfileByAuthId('uid-1')
    expect(error).toBeNull()
    expect(warning).toBeNull()
    expect(profile?.id).toBe('fp1')
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('signOut reports the transport failure in its contract shape and still clears the token', async () => {
    setAccessToken('stale-token')
    breakTransport(transportThrow)
    const { error } = await signOut()
    expect(error).toMatchObject({ message: 'Failed to fetch' })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
  })
})
