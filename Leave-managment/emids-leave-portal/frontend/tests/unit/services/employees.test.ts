import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { fetchProfileByAuthId, fetchReportIds } from '../../../src/services/employees'

beforeEach(() => resetApiClientMock())

describe('services/employees', () => {
  it('fetches the profile for the authenticated user', async () => {
    const row = { id: 'fp1', full_name: 'Vikram Deshmukh', manager: { full_name: 'Vootkuri Sai Nithin Reddy' } }
    apiRequest.mockResolvedValueOnce(row)
    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(error).toBeNull()
    expect(profile).toEqual(row)
    expect(apiRequest).toHaveBeenCalledWith('/employees/me')
  })

  it('returns the normalized error when the lookup fails', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('profile not found'), { status: 404 }))
    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(profile).toBeNull()
    expect(error).toMatchObject({ code: 404, context: 'profile lookup', userMessage: 'profile not found' })
  })

  it('lists the authenticated manager\'s direct-report ids', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
    const { ids, error } = await fetchReportIds('mgr-1')
    expect(error).toBeNull()
    expect(ids).toEqual(['a', 'b'])
    expect(apiRequest).toHaveBeenCalledWith('/employees/me/team')
  })

  it('returns an empty team without error', async () => {
    apiRequest.mockResolvedValueOnce([])
    const { ids, error } = await fetchReportIds('mgr-1')
    expect(ids).toEqual([])
    expect(error).toBeNull()
  })
})
