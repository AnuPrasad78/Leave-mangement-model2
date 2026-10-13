import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import { createSeparationRequest } from '../../../src/services/separations'

beforeEach(() => resetApiClientMock())

describe('services/separations', () => {
  it('inserts the separation request payload', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    const { error } = await createSeparationRequest({
      employee_id: 'e1',
      last_working_day: '2026-06-30',
      reason: 'Higher Studies',
      remarks: null,
    })
    expect(error).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/separation-requests', {
      method: 'POST',
      body: JSON.stringify({ last_working_day: '2026-06-30', reason: 'Higher Studies', remarks: null }),
    })
  })

  it('normalizes insert failures', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('check failure'), { status: 422 }))
    const { error } = await createSeparationRequest({ employee_id: 'e1', last_working_day: '2026-06-30', reason: 'x', remarks: null })
    expect(error.userMessage).toBe('check failure')
  })
})
