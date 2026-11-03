import { vi } from 'vitest'

vi.mock('../../../src/services/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/admin')>()
  return { ...actual, fetchLeavePolicies: vi.fn(), fetchAdminBalances: vi.fn(), adminUpsertBalance: vi.fn() }
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminLeavePolicies from '../../../src/pages/AdminLeavePolicies'
import { adminUpsertBalance, fetchAdminBalances, fetchLeavePolicies } from '../../../src/services/admin'
import type { AdminBalanceRow } from '../../../src/types/models'

const balance = (overrides: Partial<AdminBalanceRow> = {}): AdminBalanceRow => ({
  employee_id: 'e9',
  year: new Date().getFullYear(),
  opening_annual: 0,
  annual_credited: 22,
  annual_utilized: 3,
  contingency_credited: 10,
  contingency_utilized: 1,
  annual_cap: 22,
  contingency_cap: 10,
  employee: { id: 'e9', full_name: 'Vikram Deshmukh', emp_no: 'EM-20810', system_role: 'employee' },
  ...overrides,
})

describe('pages/AdminLeavePolicies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(fetchAdminBalances).mockResolvedValue({ rows: [balance()], error: null })
  })

  afterEach(() => vi.restoreAllMocks())

  function setup(setToast = vi.fn()) {
    render(
      <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
        <AdminLeavePolicies />
      </AuthContext.Provider>
    )
    return setToast
  }

  it('renders the live credit policy from the backend', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/22 \(prorated by DOJ/)).toBeInTheDocument())
    expect(screen.getByText(/Optional holiday picks/)).toBeInTheDocument()
    expect(fetchLeavePolicies).toHaveBeenCalled()
  })

  it('lists org balances for the selected year', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    expect(fetchAdminBalances).toHaveBeenCalledWith(new Date().getFullYear())
  })

  it('saves a balance adjustment through the PUT endpoint', async () => {
    const user = userEvent.setup()
    vi.mocked(adminUpsertBalance).mockResolvedValue({ row: balance(), error: null })
    setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adjust' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    const fields = screen.getAllByRole('spinbutton')
    await user.clear(fields[1]) // annual_credited
    await user.type(fields[1], '24')
    await user.click(screen.getByRole('button', { name: 'Save balance' }))
    await waitFor(() => expect(adminUpsertBalance).toHaveBeenCalledWith('e9', expect.any(Number), expect.objectContaining({ annual_credited: 24 })))
  })
})
