import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { fetchProfileByAuthId, fetchReportIds } from '../../../src/services/employees'

beforeEach(() => mockDb.reset())

describe('services/employees', () => {
  it('fetches the employee profile by auth user id', async () => {
    const row = { id: 'fp1', full_name: 'Vikram Deshmukh', manager: { full_name: 'Vootkuri Sai Nithin Reddy' } }
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: row })
    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(error).toBeNull()
    expect(profile).toEqual(row)
  })

  it('returns the normalized error when the lookup fails', async () => {
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], error: { message: 'row not found', code: 'PGRST116' } })
    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(profile).toBeNull()
    expect(error).toEqual({ code: 'PGRST116', context: 'profile lookup', userMessage: 'row not found' })
  })

  it('lists direct-report ids for a manager', async () => {
    mockDb.expectSelect('employees', { eq: ['manager_id', 'mgr-1'], data: [{ id: 'a' }, { id: 'b' }] })
    const { ids, error } = await fetchReportIds('mgr-1')
    expect(error).toBeNull()
    expect(ids).toEqual(['a', 'b'])
  })

  it('returns an empty team without error', async () => {
    mockDb.expectSelect('employees', { eq: ['manager_id', 'mgr-1'], data: [] })
    const { ids, error } = await fetchReportIds('mgr-1')
    expect(ids).toEqual([])
    expect(error).toBeNull()
  })
})
