import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { fetchMyNotifications } from '../../../src/services/notifications'

beforeEach(() => resetApiClientMock())

describe('services/notifications', () => {
  it('reads the signed-in person’s notifications', async () => {
    apiRequest.mockResolvedValueOnce([
      { id: 1, kind: 'request_decided', title: 'LV-00001 Approved', body: '…', target_type: 'leave_request', target_id: 'LV-00001', read_at: null, created_at: '2026-11-01T09:00:00Z' },
    ])
    const { rows, error } = await fetchMyNotifications()
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('request_decided')
    expect(apiRequest).toHaveBeenCalledWith('/notifications')
  })

  it('exposes failures as {error} objects', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Boom'))
    const { rows, error } = await fetchMyNotifications()
    expect(rows).toEqual([])
    expect(error?.userMessage).toBe('Boom')
  })
})
