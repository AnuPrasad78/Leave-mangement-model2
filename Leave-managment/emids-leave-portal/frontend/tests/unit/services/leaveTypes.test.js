import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../../../src/services/leaveTypes'

beforeEach(() => resetApiClientMock())

describe('services/leaveTypes', () => {
  it('lists active leave type names', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 1, name: 'Paid Time Off' }, { id: 2, name: 'Compensatory Off' }])
    const { names, error } = await fetchActiveLeaveTypeNames()
    expect(error).toBeNull()
    expect(names).toEqual(['Paid Time Off', 'Compensatory Off'])
  })

  it('resolves a leave type id by name', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 1, name: 'Paid Time Off' }])
    const { id, error } = await fetchLeaveTypeIdByName('Paid Time Off')
    expect(error).toBeNull()
    expect(id).toBe(1)
  })

  it('returns null id (not an error) for an unknown name', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 1, name: 'Paid Time Off' }])
    const { id, error } = await fetchLeaveTypeIdByName('Ghost Leave')
    expect(id).toBeNull()
    expect(error).toBeNull()
  })
})
