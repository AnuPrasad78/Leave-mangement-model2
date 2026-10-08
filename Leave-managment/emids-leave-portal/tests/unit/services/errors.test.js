import { normalizeSupabaseError } from '../../../src/services/errors'

describe('services/errors', () => {
  it('wraps a supabase error into code + friendly userMessage', () => {
    const n = normalizeSupabaseError({ message: 'You can choose only 3 optional holidays per year', code: 'P0001' })
    expect(n).toEqual({
      code: 'P0001',
      context: '',
      userMessage: 'You can choose only 3 optional holidays per year',
    })
  })

  it('passes through trigger messages as user-readable', () => {
    const n = normalizeSupabaseError({ message: 'You can only cancel your own pending request' }, 'cancel')
    expect(n.userMessage).toBe('You can only cancel your own pending request')
    expect(n.context).toBe('cancel')
  })

  it('replaces an overlapping leave request error with a friendly message', () => {
    const n = normalizeSupabaseError(
      { message: 'conflicting key value violates exclusion constraint "leave_requests_no_overlap"', code: '23503' },
      'submit request'
    )
    expect(n.userMessage).toBe('You have applied leave on the same day')
  })

  it('survives missing fields', () => {
    expect(normalizeSupabaseError(null)).toBeNull()
    expect(normalizeSupabaseError({}).userMessage).toBe('Something went wrong. Please try again.')
    expect(normalizeSupabaseError({ message: 'boom', code: undefined }).code).toBe('unknown')
  })
})
