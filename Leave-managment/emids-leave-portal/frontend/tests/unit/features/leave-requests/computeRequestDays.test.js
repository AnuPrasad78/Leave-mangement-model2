import { computeRequestDays, validateRequest } from '../../../../src/features/leave-requests/computeRequest'
import { MODES } from '../../../../src/constants'

describe('features/leave-requests/computeRequestDays', () => {
  it('counts business days inclusively for full-day mode', () => {
    expect(computeRequestDays({ from: '2026-10-12', to: '2026-10-16', mode: MODES.Full })).toBe(5)
    expect(computeRequestDays({ from: '2026-10-12', to: '2026-10-12', mode: MODES.Full })).toBe(1)
  })

  it('halves non-full modes with a 0.5 floor', () => {
    expect(computeRequestDays({ from: '2026-10-12', to: '2026-10-16', mode: MODES.FirstHalf })).toBe(2.5)
    expect(computeRequestDays({ from: '2026-10-12', to: '2026-10-12', mode: MODES.SecondHalf })).toBe(0.5)
  })

  it('returns the zero-day weekend-only range as 0 (current rule)', () => {
    expect(computeRequestDays({ from: '2026-10-10', to: '2026-10-11', mode: MODES.Full })).toBe(0)
  })

  it('returns null for reversed or incomplete ranges', () => {
    expect(computeRequestDays({ from: '2026-10-16', to: '2026-10-12', mode: MODES.Full })).toBeNull()
    expect(computeRequestDays({ from: '', to: '2026-10-12', mode: MODES.Full })).toBeNull()
    expect(computeRequestDays({ from: '2026-10-12', to: '', mode: MODES.Full })).toBeNull()
  })
})

describe('features/leave-requests/validateRequest', () => {
  const valid = { type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-14', reason: 'Family function' }

  it('accepts a fully filled request with no errors', () => {
    expect(validateRequest(valid)).toEqual({})
  })

  it('reports the pinned field rules with the exact legacy wording', () => {
    const errs = validateRequest({ reason: '' })
    expect(errs.type).toBe('Select a leave type.')
    expect(errs.from).toBe('Pick a from date.')
    expect(errs.to).toBe('Pick a to date.')
    expect(errs.reason).toBe('Tell the approver why, in a line or two.')
  })

  it('rejects a reversed range only when both dates are present', () => {
    expect(validateRequest({ ...valid, to: '2026-10-05' }).to).toBe('End date is before the start date.')
    expect(validateRequest({ ...valid, to: '' }).to).toBe('Pick a to date.')
  })

  it('accepts reasons of five characters or more', () => {
    expect(validateRequest({ ...valid, reason: '12345' })).toEqual({})
    expect(validateRequest({ ...valid, reason: '1234' }).reason).toBeTruthy()
  })
})
