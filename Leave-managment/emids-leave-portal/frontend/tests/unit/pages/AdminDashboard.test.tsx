import { vi } from 'vitest'

vi.mock('../../../src/services/admin', () => ({
  fetchStaleRequests: vi.fn(),
  fetchAdminEmployees: vi.fn(),
  fetchOrgRequests: vi.fn(),
  fetchLeavePolicies: vi.fn(),
  adminCarryForward: vi.fn(),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminDashboard from '../../../src/pages/AdminDashboard'
import { adminCarryForward, fetchAdminEmployees, fetchLeavePolicies, fetchOrgRequests, fetchStaleRequests } from '../../../src/services/admin'

describe('pages/AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchStaleRequests).mockResolvedValue({ rows: [], error: null })
    vi.mocked(fetchAdminEmployees).mockResolvedValue({
      page: {
        items: [
          { system_role: 'manager' },
          { system_role: 'employee' },
          { system_role: 'employee' },
        ] as unknown as Awaited<ReturnType<typeof fetchAdminEmployees>>['page']['items'],
        total: 3,
      },
      error: null,
    })
    vi.mocked(fetchOrgRequests).mockResolvedValue({
      rows: [
        { status: 'Pending' },
        { status: 'Pending' },
        { status: 'Approved' },
      ] as unknown as Awaited<ReturnType<typeof fetchOrgRequests>>['rows'],
      error: null,
    })
    vi.mocked(fetchLeavePolicies).mockResolvedValue({
      config: {
        annual_days_per_year: 22,
        contingency_days_per_year: 10,
        carry_forward_max: 6,
        optional_holidays_max: 3,
        prorated_by: 'doj',
        proration_method: 'months worked / 12',
      },
      error: null,
    })
  })

  afterEach(() => vi.restoreAllMocks())

  function setup(setToast = vi.fn()) {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
          <AdminDashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    )
    return setToast
  }

  it('renders live org counts instead of hardcoded tiles', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ setToast: vi.fn() } as unknown as AuthContextValue}>
          <AdminDashboard />
        </AuthContext.Provider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument()) // people
    expect(screen.getByText('1')).toBeInTheDocument() // managers
    expect(screen.getByText('2')).toBeInTheDocument() // pending
    expect(screen.getByText(/22 \(prorated by DOJ/)).toBeInTheDocument()
    expect(screen.getByText(/Carry-forward ceiling/i)).toBeInTheDocument()
  })

  it('announces a successful carry-forward run with the year', async () => {
    const user = userEvent.setup()
    vi.mocked(adminCarryForward).mockResolvedValue({
      summary: { ok: true, source_year: 2025, target_year: 2026, employees: 4 },
      error: null,
    })
    const setToast = setup()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Run carry-forward for 2025/ })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: /Run carry-forward for 2025/ }))
    await waitFor(() =>
      expect(setToast).toHaveBeenCalledWith('Carry-forward for 2025 done · 4 employees', 'ok')
    )
    expect(fetchOrgRequests).toHaveBeenCalled() // live data, not constants
    expect(adminCarryForward).toHaveBeenCalledWith(2025)
  })

  it('toasts the failure message when a tile read errors', async () => {
    vi.mocked(fetchStaleRequests).mockResolvedValue({
      rows: [],
      error: { code: 500, context: 'stale request lookup', userMessage: 'Cannot reach the trail' },
    })
    const setToast = setup()
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Cannot reach the trail', 'red'))
  })
})
