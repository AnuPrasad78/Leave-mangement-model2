import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import {
  fetchAllHolidays,
  fetchOptionalPicks,
  addOptionalPick,
  removeOptionalPick,
  isPickCapError,
} from '../../../src/services/holidays'

beforeEach(() => resetApiClientMock())

describe('services/holidays', () => {
  it('fetches all holiday rows date-ordered', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 1, name: 'Diwali' }])
    const { rows, error } = await fetchAllHolidays()
    expect(error).toBeNull()
    expect(rows).toEqual([{ id: 1, name: 'Diwali' }])
    expect(apiRequest).toHaveBeenCalledWith('/holidays')
  })

  it('fetches picked holiday ids for an employee', async () => {
    apiRequest.mockResolvedValueOnce([1, 2])
    const { holidayIds, error } = await fetchOptionalPicks('e1')
    expect(error).toBeNull()
    expect(holidayIds).toEqual([1, 2])
  })

  it('adds and removes picks', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    expect((await addOptionalPick('e1', 1)).error).toBeNull()
    expect(apiRequest).toHaveBeenLastCalledWith('/holidays/picks', { method: 'POST', body: '{"holiday_id":1}' })
    apiRequest.mockResolvedValueOnce({ ok: true })
    expect((await removeOptionalPick('e1', 1)).error).toBeNull()
    expect(apiRequest).toHaveBeenLastCalledWith('/holidays/picks/1', { method: 'DELETE' })
  })

  it('recognizes the pick-cap trigger error without string-matching pages', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('You can choose only 3 optional holidays per year'), { status: 409 }))
    const { error } = await addOptionalPick('e1', 9)
    expect(error).not.toBeNull()
    expect(isPickCapError(error)).toBe(true)
    expect(isPickCapError({ message: 'some other failure' } as never)).toBe(false)
    expect(isPickCapError(null)).toBe(false)
  })
})
