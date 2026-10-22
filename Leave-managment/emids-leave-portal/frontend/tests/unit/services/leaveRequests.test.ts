import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import {
  fetchMine,
  fetchTeam,
  insertMine,
  updateMine,
  cancelMine,
  decide,
  decideMany,
} from '../../../src/services/leaveRequests'

beforeEach(() => resetApiClientMock())

const row = {
  request_no: 'LV-2026-00007',
  employee_id: 'e1',
  start_date: '2026-03-02',
  end_date: '2026-03-06',
  days: '5',
  mode: 'Full Day',
  reason: 'Trip',
  status: 'Pending',
  requested_on: '2026-02-20',
  leave_types: { name: 'Paid Time Off' },
  employees: { full_name: 'Vikram', emp_no: 'EM-20810' },
}

describe('services/leaveRequests', () => {
  it('fetches my requests newest-first', async () => {
    apiRequest.mockResolvedValueOnce([row])
    const { rows, error } = await fetchMine('e1')
    expect(error).toBeNull()
    expect(rows).toEqual([row])
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/mine')
  })

  it('fetches the authenticated manager team queue', async () => {
    apiRequest.mockResolvedValueOnce([row])
    const { rows, error } = await fetchTeam(['a', 'b'])
    expect(error).toBeNull()
    expect(rows).toEqual([row])
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/team')
  })

  it('inserts a request using its leave-type name', async () => {
    apiRequest.mockResolvedValueOnce({ requestNo: 'LV-2026-00099' })
    const payload = { type: 'Paid Time Off', from: '2026-03-02', to: '2026-03-06', days: 5, mode: 'Full Day' as const, reason: 'x', requestedOn: '2026-02-20' }
    const { requestNo, error } = await insertMine(payload)
    expect(error).toBeNull()
    expect(requestNo).toBe('LV-2026-00099')
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests', { method: 'POST', body: JSON.stringify(payload) })
  })

  it('updates a pending request with the editable fields only', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    const payload = {
      type: 'Paid Time Off',
      from: '2026-03-03',
      to: '2026-03-06',
      days: 4,
      mode: 'Full Day' as const,
      reason: 'Updated trip',
    }
    const { error } = await updateMine('LV-2026-00007', payload)
    expect(error).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/LV-2026-00007', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  })

  it('surfaces insert failures as outcome-unknown for mutations', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('not enough balance'), { status: 409 }))
    const { requestNo, error } = await insertMine({ type: 'PTO', from: '2026-03-02', to: '2026-03-02', days: 1, mode: 'Full Day' as const, reason: 'x', requestedOn: '2026-02-20' })
    expect(requestNo).toBeNull()
    expect(error!.code).toBe(409)
    expect(error!.userMessage).toContain('not enough balance')
    expect(error!.outcomeUnknown).toBe(true)
  })

  it('cancels the authenticated user\'s pending request', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    const { error } = await cancelMine('LV-1', 'e1')
    expect(error).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/LV-1/cancel', { method: 'POST' })
  })

  it('records a decision without client-supplied approver identity', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    const { error } = await decide('LV-1', 'Approved', 'mgr-1')
    expect(error).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/LV-1/decision', { method: 'POST', body: '{"decision":"Approved"}' })
  })

  it('bulk-decides through the manager endpoint', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true })
    const { error } = await decideMany(['LV-1', 'LV-2'], 'Approved', 'mgr-1')
    expect(error).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/leave-requests/bulk-decision', { method: 'POST', body: '{"request_nos":["LV-1","LV-2"],"decision":"Approved"}' })
  })

  it('passes API authorization violations through, flagged outcome-unknown for mutations', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('You can only cancel your own pending request'), { status: 403 }))
    const { error } = await cancelMine('LV-1', 'e2')
    expect(error!.code).toBe(403)
    expect(error!.userMessage).toContain('You can only cancel your own pending request')
    expect(error!.outcomeUnknown).toBe(true)
  })
})
