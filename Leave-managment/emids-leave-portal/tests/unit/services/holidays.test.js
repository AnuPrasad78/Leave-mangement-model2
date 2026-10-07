import { vi } from 'vitest'

vi.mock('../../../src/lib/supabase', async () => {
  const { mockDb } = await import('../mocks/supabase')
  return { supabase: mockDb }
})

import { mockDb } from '../mocks/supabase'
import {
  fetchAllHolidays,
  fetchOptionalPicks,
  addOptionalPick,
  removeOptionalPick,
  isPickCapError,
} from '../../../src/services/holidays'

beforeEach(() => mockDb.reset())

describe('services/holidays', () => {
  it('fetches all holiday rows date-ordered', async () => {
    mockDb.expectSelect('holidays', { data: [{ id: 'h1', name: 'Diwali' }] })
    const { rows, error } = await fetchAllHolidays()
    expect(error).toBeNull()
    expect(rows).toEqual([{ id: 'h1', name: 'Diwali' }])
  })

  it('fetches picked holiday ids for an employee', async () => {
    mockDb.expectSelect('optional_holiday_picks', { eq: ['employee_id', 'e1'], data: [{ holiday_id: 'h1' }, { holiday_id: 'h2' }] })
    const { holidayIds, error } = await fetchOptionalPicks('e1')
    expect(error).toBeNull()
    expect(holidayIds).toEqual(['h1', 'h2'])
  })

  it('adds and removes picks', async () => {
    mockDb.expectInsert('optional_holiday_picks')
    expect((await addOptionalPick('e1', 'h1')).error).toBeNull()
    mockDb.expectDelete('optional_holiday_picks')
    expect((await removeOptionalPick('e1', 'h1')).error).toBeNull()
  })

  it('recognizes the pick-cap trigger error without string-matching pages', async () => {
    mockDb.expectInsert('optional_holiday_picks', {
      error: { message: 'You can choose only 3 optional holidays per year', code: 'P0001' },
    })
    const { error } = await addOptionalPick('e1', 'h9')
    expect(error).not.toBeNull()
    expect(isPickCapError(error)).toBe(true)
    expect(isPickCapError({ message: 'some other failure' })).toBe(false)
    expect(isPickCapError(null)).toBe(false)
  })
})
