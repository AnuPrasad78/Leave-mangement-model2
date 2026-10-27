import { validateSeparation } from '../../../../src/features/separations/validateSeparation'

const today = '2026-10-08'

describe('features/separations/validateSeparation', () => {
  it('requires a last working day and a reason with the legacy wording', () => {
    const errs = validateSeparation({ lwd: '', reason: '', today })
    expect(errs.lwd).toBe('Pick your proposed last working day.')
    expect(errs.reason).toBe('Select a reason for separation.')
  })

  it('rejects a last working day before today', () => {
    const errs = validateSeparation({ lwd: '2026-10-01', reason: 'Higher Studies', today })
    expect(errs.lwd).toBe('Last working day must be in the future.')
    expect(errs.reason).toBeUndefined()
  })

  it('treats today itself as a future last working day', () => {
    expect(validateSeparation({ lwd: today, reason: 'Higher Studies', today })).toEqual({})
  })

  it('accepts a valid request', () => {
    expect(validateSeparation({ lwd: '2027-01-01', reason: 'Higher Studies', today })).toEqual({})
  })
})
