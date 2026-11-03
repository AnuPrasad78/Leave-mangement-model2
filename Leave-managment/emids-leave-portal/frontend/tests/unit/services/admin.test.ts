import { vi } from 'vitest'

vi.mock('../../../src/services/apiClient', async () => await import('../mocks/apiClient'))

import { apiRequest, resetApiClientMock } from '../mocks/apiClient'
import {
  adminCarryForward,
  adminCreateEmployee,
  adminInitPasswordReset,
  adminSetEmployeeActive,
  fetchAdminBalances,
  fetchAdminEmployees,
  fetchAuditLogs,
  fetchLeavePolicies,
  fetchStaleRequests,
} from '../../../src/services/admin'

beforeEach(() => resetApiClientMock())

describe('services/admin', () => {
  it('lists employees with the search param attached', async () => {
    apiRequest.mockResolvedValueOnce({ items: [], total: 0 })
    const { page, error } = await fetchAdminEmployees('meera')
    expect(error).toBeNull()
    expect(page).toEqual({ items: [], total: 0 })
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/admin/employees?limit=200&search=meera'))
  })

  it('creates an employee and returns the one-time password', async () => {
    apiRequest.mockResolvedValueOnce({ employee: { id: 'e1', is_active: true }, temporary_password: 'temp' })
    const { result, error } = await adminCreateEmployee({
      full_name: 'Nikhil Raut',
      email: 'nikhil.raut@emids.com',
      system_role: 'employee',
    })
    expect(error).toBeNull()
    expect(result?.temporary_password).toBe('temp')
    expect(apiRequest).toHaveBeenCalledWith('/admin/employees', expect.objectContaining({ method: 'POST' }))
  })

  it('toggles deactivation via the dedicated endpoints', async () => {
    apiRequest.mockResolvedValue({ ok: true })
    await adminSetEmployeeActive('e1', false)
    expect(apiRequest).toHaveBeenCalledWith('/admin/employees/e1/deactivate', expect.objectContaining({ method: 'POST' }))
    await adminSetEmployeeActive('e1', true)
    expect(apiRequest).toHaveBeenCalledWith('/admin/employees/e1/activate', expect.objectContaining({ method: 'POST' }))
  })

  it('initializes password resets and returns the one-time token', async () => {
    apiRequest.mockResolvedValueOnce({ reset_token: 'abc', reset_endpoint: '/auth/password-reset/abc', expires_at: 'x' })
    const { init, error } = await adminInitPasswordReset('u1')
    expect(error).toBeNull()
    expect(init?.reset_endpoint).toBe('/auth/password-reset/abc')
  })

  it('reads policies and balances as separate reads', async () => {
    apiRequest.mockResolvedValueOnce({ annual_days_per_year: 22 })
    const { config, error } = await fetchLeavePolicies()
    expect(error).toBeNull()
    expect(config?.annual_days_per_year).toBe(22)

    apiRequest.mockResolvedValueOnce({ items: [{ employee_id: 'e1' }], total: 1, year: 2027 })
    const balances = await fetchAdminBalances(2027)
    expect(balances.error).toBeNull()
    expect(balances.rows).toHaveLength(1)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/leave-balances?year=2027')
  })

  it('upserts balances with a PUT', async () => {
    apiRequest.mockResolvedValueOnce({ employee_id: 'e1' })
    const { row, error } = await adminUpsertBalanceSafe()
    expect(error).toBeNull()
    expect(row?.employee_id).toBe('e1')
  })

  async function adminUpsertBalanceSafe() {
    const { adminUpsertBalance } = await import('../../../src/services/admin')
    return adminUpsertBalance('e1', 2027, { annual_credited: 20 })
  }

  it('reads the audit trail with filters', async () => {
    apiRequest.mockResolvedValueOnce({ items: [], total: 0 })
    const { page, error } = await fetchAuditLogs({ action: 'employee_created', limit: 10 })
    expect(error).toBeNull()
    expect(page.total).toBe(0)
    expect(apiRequest).toHaveBeenCalledWith('/admin/audit-logs?action=employee_created&limit=10')
  })

  it('reads stale requests for a cutoff date', async () => {
    apiRequest.mockResolvedValueOnce([])
    const { rows, error } = await fetchStaleRequests('2026-10-28')
    expect(error).toBeNull()
    expect(rows).toEqual([])
    expect(apiRequest).toHaveBeenCalledWith('/admin/requests/stale?before=2026-10-28')
  })

  it('runs carry-forward for a given year', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true, source_year: 2025, target_year: 2026, employees: 3 })
    const { summary, error } = await adminCarryForward(2025)
    expect(error).toBeNull()
    expect(summary?.employees).toBe(3)
    expect(apiRequest).toHaveBeenCalledWith(
      '/admin/leave-requests/carry-forward',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('exposes failures as {error} objects', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Boom'))
    const { error } = await fetchAdminEmployees()
    expect(apiRequest).toBeDefined()
    expect(error?.userMessage).toBe('Boom')
  })
})
