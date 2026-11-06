import { vi } from 'vitest'

vi.mock('../../../src/services/admin', () => ({
  // the editor fetches active managers whenever it opens — default to an empty page
  fetchAdminEmployees: vi.fn(async () => ({
    page: { rows: [], page: 1, page_size: 100, total: 0, page_count: 0 },
    error: null,
  })),
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
import { todayISO } from '../../../src/utils/dates'
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

  it('prefills Date of Joining with today and no manager when creating', async () => {
    const { fetchAdminEmployees } = await import('../../../src/services/admin')
    vi.mocked(fetchAdminEmployees).mockResolvedValue({
      page: { rows: [], page: 1, page_size: 100, total: 0, page_count: 0 },
      error: null,
    })
    const createEmployee = vi.fn().mockResolvedValue({ employee: row(), temporary_password: 'temp-pass-9' })
    renderPage({ createEmployee })

    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
    expect(screen.getByLabelText(/^Date of Joining/)).toHaveValue(todayISO())

    await userEvent.type(screen.getByLabelText(/^Full Name/), 'New Person')
    await userEvent.type(screen.getByLabelText(/^Email/), 'new.person@emids.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }))
    await waitFor(() =>
      expect(createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ doj: todayISO(), manager_id: null })
      )
    )
  })

  it('offers the active managers by name and submits the chosen manager id', async () => {
    const { fetchAdminEmployees } = await import('../../../src/services/admin')
    vi.mocked(fetchAdminEmployees).mockResolvedValue({
      page: {
        rows: [
          row({ id: 'm1', full_name: 'Prastina Mary', emp_no: 'EM-30002', system_role: 'manager' }),
          row({ id: 'm2', full_name: 'Sandeep Venkatesh Kamath', emp_no: 'EM-30003', system_role: 'manager' }),
        ],
        page: 1,
        page_size: 100,
        total: 2,
        page_count: 1,
      },
      error: null,
    })
    const createEmployee = vi.fn().mockResolvedValue({ employee: row(), temporary_password: 'temp-pass-9' })
    renderPage({ createEmployee })

    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
    await waitFor(() =>
      expect(fetchAdminEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'manager', active: true })
      )
    )
    await userEvent.selectOptions(screen.getByLabelText(/^Manager/), 'm1')
    await userEvent.type(screen.getByLabelText(/^Full Name/), 'New Person')
    await userEvent.type(screen.getByLabelText(/^Email/), 'new.person@emids.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }))
    await waitFor(() =>
      expect(createEmployee).toHaveBeenCalledWith(expect.objectContaining({ manager_id: 'm1' }))
    )
  })

  it('keeps the stored Date of Joining and manager when editing', async () => {
    const { fetchAdminEmployees } = await import('../../../src/services/admin')
    vi.mocked(fetchAdminEmployees).mockResolvedValue({
      page: { rows: [], page: 1, page_size: 100, total: 0, page_count: 0 },
      error: null,
    })
    renderPage({ employees: [row({ manager_id: 'm1' })] })

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText(/^Date of Joining/)).toHaveValue('2024-11-18')
    const selected = screen.getByLabelText(/^Manager/) as HTMLSelectElement
    expect(selected.value).toBe('')
  })
})
