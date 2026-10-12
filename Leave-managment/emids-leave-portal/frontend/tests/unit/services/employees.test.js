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

  it('falls back to a manager-name fetch when the same-table embed degrades to []', async () => {
    const row = { id: 'fp1', full_name: 'Sai Nithin Reddy', manager_id: 'mgr-1', manager: [] }
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: row })
    mockDb.expectSelect('employees', { eq: ['id', 'mgr-1'], data: { full_name: 'Prastina Mary' } })
    const { profile, error } = await fetchProfileByAuthId('uid-1')
    expect(error).toBeNull()
    expect(profile.manager).toEqual({ full_name: 'Prastina Mary' })
  })

  it('does not fetch the manager again when the embed already resolved', async () => {
    const row = { id: 'fp1', full_name: 'Vikram', manager_id: 'mgr-1', manager: { full_name: 'Sai' } }
    mockDb.expectSelect('employees', { eq: ['auth_user_id', 'uid-1'], data: row })
    const { profile } = await fetchProfileByAuthId('uid-1')
    expect(profile.manager).toEqual({ full_name: 'Sai' })
    expect(mockDb.calls).toHaveLength(1)
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
