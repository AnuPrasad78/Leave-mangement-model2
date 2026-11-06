import { vi } from 'vitest'

vi.mock('../../../src/services/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/admin')>()
  return { ...actual, fetchAdminBalances: vi.fn(), adminUpsertBalance: vi.fn() }
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminLeavePolicies from '../../../src/pages/AdminLeavePolicies'
import { adminUpsertBalance, fetchAdminBalances } from '../../../src/services/admin'
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
    vi.mocked(fetchAdminBalances).mockResolvedValue({
      page: { rows: [balance()], page: 1, page_size: 10, total: 1, page_count: 1, year: new Date().getFullYear() },
      error: null,
    })
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

  it('shows the balance sheet only — the credit policy lives on the overview', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    expect(screen.queryByText('Credit policy')).not.toBeInTheDocument()
  })

  it('lists org balances for the selected year', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    expect(fetchAdminBalances).toHaveBeenCalledWith(new Date().getFullYear(), 1)
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
