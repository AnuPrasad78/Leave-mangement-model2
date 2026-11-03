import { vi } from 'vitest'

vi.mock('../../../src/services/admin', () => ({
  fetchAdminEmployees: vi.fn(),
  adminCreateEmployee: vi.fn(),
  adminUpdateEmployee: vi.fn(),
  adminSetEmployeeActive: vi.fn(),
  adminInitPasswordReset: vi.fn(),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import { AdminContext, type AdminContextValue } from '../../../src/store/AdminContext'
import AdminEmployees from '../../../src/pages/AdminEmployees'
import type { EmployeeAdminRow } from '../../../src/types/models'

const row = (overrides: Partial<EmployeeAdminRow> = {}): EmployeeAdminRow => ({
  id: 'e1',
  user_id: 'u1',
  emp_no: 'EM-30001',
  full_name: 'Meera Krishnan',
  initials: 'MK',
  email: 'meera.krishnan@emids.com',
  job_title: 'Consultant',
  doj: '2024-11-18',
  account: null,
  project_name: null,
  function_name: null,
  manager_id: null,
  delivery_partner_name: null,
  location: 'Bangalore, IN',
  system_role: 'employee',
  is_active: true,
  created_at: '2024-01-10T00:00:00Z',
  ...overrides,
})

function renderPage(overrides: Partial<AdminContextValue> = {}, setToast = vi.fn()) {
  render(
    <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
      <AdminContext.Provider
        value={
          {
            employees: [row()],
            total: 1,
            page: 1,
            pageCount: 1,
            setPage: vi.fn(),
            loading: false,
            search: '',
            setSearch: vi.fn(),
            reload: vi.fn(),
            createEmployee: vi.fn(),
            updateEmployee: vi.fn(),
            setEmployeeActive: vi.fn(),
            initPasswordReset: vi.fn(),
            ...overrides,
          } as unknown as AdminContextValue
        }
      >
        <AdminEmployees />
      </AdminContext.Provider>
    </AuthContext.Provider>
  )
  return setToast
}

describe('pages/AdminEmployees', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('renders the employee table with the seeded row', async () => {
    renderPage()
    expect(screen.getByText('Meera Krishnan')).toBeInTheDocument()
    expect(screen.getByText('EM-30001')).toBeInTheDocument()
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText(/Total 1/)).toBeInTheDocument()
  })

  it('shows a one-time password notice when a create finishes with a generated password', async () => {
    const setToast = vi.fn()
    const createEmployee = vi.fn().mockResolvedValue({ employee: row(), temporary_password: 'temp-pass-9' })
    renderPage({ createEmployee }, setToast)
    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
    await userEvent.type(screen.getByLabelText(/^Full Name/), 'New Person')
    await userEvent.type(screen.getByLabelText(/^Email/), 'new.person@emids.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }))
    await waitFor(() =>
      expect(setToast).toHaveBeenCalledWith(expect.stringMatching(/one-time password/), 'ok')
    )
  })

  it('opens the deactivate confirmation from the row action', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(screen.getByText('Deactivate Meera Krishnan?')).toBeInTheDocument()
  })

  it('reflects the deactivated state without touching AuthContext state', async () => {
    renderPage({ employees: [row({ is_active: false })] })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })
})
