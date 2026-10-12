import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import {
  fetchMine,
  fetchTeam,
  insertMine,
  cancelMine,
  decide,
  decideMany,
} from '../../../src/services/leaveRequests'

beforeEach(() => mockDb.reset())

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
    mockDb.expectSelect('leave_requests', { eq: ['employee_id', 'e1'], data: [row] })
    const { rows, error } = await fetchMine('e1')
    expect(error).toBeNull()
    expect(rows).toEqual([row])
  })

  it('fetches the team queue in a single in() query', async () => {
    mockDb.expectSelect('leave_requests', { data: [row] })
    const { rows, error } = await fetchTeam(['a', 'b'])
    expect(error).toBeNull()
    expect(rows).toEqual([row])
  })

  it('inserts a request and returns its request_no', async () => {
    mockDb.expectInsert('leave_requests', { data: { request_no: 'LV-2026-00099' } })
    const { requestNo, error } = await insertMine({ employee_id: 'e1', leave_type_id: 'lt1', start_date: '2026-03-02', end_date: '2026-03-06', days: 5, mode: 'Full Day', reason: 'x', requested_on: '2026-02-20' })
    expect(error).toBeNull()
    expect(requestNo).toBe('LV-2026-00099')
  })

  it('surfaces insert failures as normalized errors', async () => {
    mockDb.expectInsert('leave_requests', { error: { message: 'not enough balance', code: '23514' } })
    const { requestNo, error } = await insertMine({ employee_id: 'e1' })
    expect(requestNo).toBeNull()
    expect(error.code).toBe('23514')
    expect(error.userMessage).toBe('not enough balance')
  })

  it('cancels only own pending request', async () => {
    mockDb.expectUpdate('leave_requests')
    const { error } = await cancelMine('LV-1', 'e1')
    expect(error).toBeNull()
  })

  it('records a decision with approver + timestamp', async () => {
    mockDb.expectUpdate('leave_requests')
    const { error } = await decide('LV-1', 'Approved', 'mgr-1')
    expect(error).toBeNull()
  })

  it('bulk-decides through a single update', async () => {
    mockDb.expectUpdate('leave_requests')
    const { error } = await decideMany(['LV-1', 'LV-2'], 'Approved', 'mgr-1')
    expect(error).toBeNull()
  })

  it('passes DB guard violations through', async () => {
    mockDb.expectUpdate('leave_requests', { error: { message: 'You can only cancel your own pending request' } })
    const { error } = await cancelMine('LV-1', 'e2')
    expect(error.userMessage).toBe('You can only cancel your own pending request')
  })
})
