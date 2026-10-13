import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { fetchLatestBalances } from '../../../src/services/balances'

beforeEach(() => resetApiClientMock())

describe('services/balances', () => {
  it('returns the latest balance row or null', async () => {
    apiRequest.mockResolvedValueOnce({ year: 2026, annual_credited: 18 })
    const { row, error } = await fetchLatestBalances('e1')
    expect(error).toBeNull()
    expect(row).toEqual({ year: 2026, annual_credited: 18 })
    expect(apiRequest).toHaveBeenCalledWith('/balances/me')
  })

  it('returns null row when no balance exists (not an error)', async () => {
    apiRequest.mockResolvedValueOnce(null)
    const { row, error } = await fetchLatestBalances('e1')
    expect(row).toBeNull()
    expect(error).toBeNull()
  })
})
