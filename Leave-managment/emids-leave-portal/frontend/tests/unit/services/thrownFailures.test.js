import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { fetchMine, insertMine } from '../../../src/services/leaveRequests'
import { fetchLatestBalances } from '../../../src/services/balances'
import { fetchProfileByAuthId, fetchReportIds } from '../../../src/services/employees'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../../../src/services/leaveTypes'
import { fetchAllHolidays, fetchOptionalPicks, addOptionalPick, removeOptionalPick } from '../../../src/services/holidays'
import { createSeparationRequest } from '../../../src/services/separations'
import { signInWithPassword, signOut } from '../../../src/services/auth'
import { TRANSPORT_USER_MESSAGE } from '../../../src/services/errors'

const originalFrom = mockDb.from.bind(mockDb)

// Route every (or every nth) supabase query through a throwing path so the
// service exercises its thrown-transport normalization, not just in-band errors.
function breakFrom(fn) {
  let call = 0
  const spy = vi.spyOn(mockDb, 'from')
  spy.mockImplementation((table) => fn({ call: ++call, table, original: (t) => originalFrom(t) }))
  return spy
}

beforeEach(() => mockDb.reset())
afterEach(() => vi.restoreAllMocks())

describe('services — thrown transport failures keep the normalized contract', () => {
  it('read services retry a transient throw (bounded) then normalize to the transport wording', async () => {
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
        const spy = breakFrom(() => {
          throw Object.assign(new Error('Failed to fetch'))
        })
        const pending = run()
        await vi.advanceTimersByTimeAsync(10000)
        const result = await pending
        expect(result.error).toMatchObject({ code: 'unknown', userMessage: TRANSPORT_USER_MESSAGE })
        expect(spy).toHaveBeenCalledTimes(3) // bounded: 1 attempt + 2 retries
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('mutation services normalize a thrown transport failure as AMBIGUOUS without retrying', async () => {
    const spy = breakFrom(() => {
      throw Object.assign(new Error('Failed to fetch'))
    })
    const results = [
      await insertMine({ employee_id: 'e1' }),
      await addOptionalPick('e1', 9),
      await removeOptionalPick('e1', 9),
      await createSeparationRequest({ employee_id: 'e1', last_working_day: '2099-01-01', reason: 'Other', remarks: null }),
    ]
    for (const result of results) {
      expect(result.error).toMatchObject({ ambiguous: true })
      expect(result.error.userMessage).toContain(TRANSPORT_USER_MESSAGE)
      expect(result.error.userMessage).toContain('unconfirmed')
    }
    expect(spy).toHaveBeenCalledTimes(4) // one attempt each, no retries
  })

  it('an aborted request normalizes to the transport wording without retrying', async () => {
    const spy = breakFrom(() => {
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    })
    const { error } = await fetchMine('e1')
    expect(error).toMatchObject({ userMessage: TRANSPORT_USER_MESSAGE })
    expect(error?.code).toBe('unknown')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('signInWithPassword folds a thrown transport failure into its raw error shape', async () => {
    vi.spyOn(mockDb.auth, 'signInWithPassword').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { data, error } = await signInWithPassword('x@emids.com', 'pw')
    expect(data).toBeNull()
    expect(error.message).toBe(TRANSPORT_USER_MESSAGE)
  })

  it('in-band non-transient wording still passes through untouched', async () => {
    mockDb.expectInsert('leave_requests', { error: { message: 'not enough balance', code: '23514' } })
    const { error } = await insertMine({ employee_id: 'e1' })
    expect(error.userMessage).toBe('not enough balance')
  })

  it('does not discard a failed secondary (manager-name fallback) read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const row = { id: 'fp1', full_name: 'Sai Nithin Reddy', manager_id: 'mgr-1', manager: [] }
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: row })
    let call = 0
    vi.spyOn(mockDb, 'from').mockImplementation((table) => {
      call++
      if (call > 1) throw Object.assign(new Error('Failed to fetch'))
      return originalFrom(table)
    })

    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(error).toBeNull()
    expect(profile?.id).toBe('fp1')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe('[portal] manager-name fallback failed:')
    expect(warn.mock.calls[0][1]).toBe(TRANSPORT_USER_MESSAGE)
  })

  it('signOut keeps its raw-rejecting contract; the store handles the catch', async () => {
    const signOutSpy = vi.spyOn(mockDb.auth, 'signOut').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(signOut()).rejects.toThrow('Failed to fetch')
    expect(signOutSpy).toHaveBeenCalledTimes(1)
  })
})
