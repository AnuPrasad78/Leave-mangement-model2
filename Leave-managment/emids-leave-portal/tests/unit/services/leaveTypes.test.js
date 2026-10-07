import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../../../src/services/leaveTypes'

beforeEach(() => mockDb.reset())

describe('services/leaveTypes', () => {
  it('lists active leave type names', async () => {
    mockDb.expectSelect('leave_types', { data: [{ name: 'Paid Time Off' }, { name: 'Compensatory Off' }] })
    const { names, error } = await fetchActiveLeaveTypeNames()
    expect(error).toBeNull()
    expect(names).toEqual(['Paid Time Off', 'Compensatory Off'])
  })

  it('resolves a leave type id by name', async () => {
    mockDb.expectSelect('leave_types', { eq: ['name', 'Paid Time Off'], data: { id: 'lt-1' } })
    const { id, error } = await fetchLeaveTypeIdByName('Paid Time Off')
    expect(error).toBeNull()
    expect(id).toBe('lt-1')
  })

  it('returns null id (not an error) for an unknown name', async () => {
    mockDb.expectSelect('leave_types', { eq: ['name', 'Ghost Leave'], data: null })
    const { id, error } = await fetchLeaveTypeIdByName('Ghost Leave')
    expect(id).toBeNull()
    expect(error).toBeNull()
  })
})
