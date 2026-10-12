import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import { createSeparationRequest } from '../../../src/services/separations'

beforeEach(() => mockDb.reset())

describe('services/separations', () => {
  it('inserts the separation request payload', async () => {
    mockDb.expectInsert('separation_requests')
    const { error } = await createSeparationRequest({
      employee_id: 'e1',
      last_working_day: '2026-06-30',
      reason: 'Higher Studies',
      remarks: null,
    })
    expect(error).toBeNull()
  })

  it('normalizes insert failures', async () => {
    mockDb.expectInsert('separation_requests', { error: { message: 'check failure', code: '23514' } })
    const { error } = await createSeparationRequest({ employee_id: 'e1', last_working_day: '2026-06-30', reason: 'x', remarks: null })
    expect(error.userMessage).toBe('check failure')
  })
})
