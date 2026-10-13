import { canApprove } from '../../../src/utils/roles'

describe('utils/roles', () => {
  it('approves for manager and admin', () => {
    expect(canApprove({ system_role: 'manager' })).toBe(true)
    expect(canApprove({ system_role: 'admin' })).toBe(true)
  })
  it('denies employee and unprofiled', () => {
    expect(canApprove({ system_role: 'employee' })).toBe(false)
    expect(canApprove({} as unknown as Parameters<typeof canApprove>[0])).toBe(false)
    expect(canApprove(null)).toBe(false)
  })
})
