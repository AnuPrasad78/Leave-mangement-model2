import { vi } from 'vitest'

vi.mock('../../../src/services/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/admin')>()
  return { ...actual, fetchAdminEmployees: vi.fn(), adminUpdateEmployee: vi.fn(), adminSetEmployeeActive: vi.fn() }
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import { AdminContext, type AdminContextValue } from '../../../src/store/AdminContext'
import AdminRoster from '../../../src/pages/AdminRoster'
import { adminSetEmployeeActive, adminUpdateEmployee, fetchAdminEmployees } from '../../../src/services/admin'
import type { EmployeeAdminRow } from '../../../src/types/models'

const person = (overrides: Partial<EmployeeAdminRow> = {}): EmployeeAdminRow => ({
  id: 'e-m1',
  user_id: 'u-m1',
  emp_no: 'EM-30001',
  full_name: 'Rhea Menon',
  initials: 'RM',
  email: 'rhea.menon@emids.com',
  job_title: 'Delivery Manager',
  doj: '2024-01-10',
  account: null,
  project_name: null,
  function_name: null,
  manager_id: null,
  delivery_partner_name: null,
  location: 'Bangalore, IN',
  system_role: 'manager',
  is_active: true,
  created_at: '2024-01-10T00:00:00Z',
  ...overrides,
})

const people = () => [
  person(),
  person({ id: 'e-e1', full_name: 'Vikram Deshmukh', system_role: 'employee', manager_id: 'e-m1', email: 'vikram.deshmukh@emids.com', emp_no: 'EM-30211', job_title: 'Consultant' }),
  person({ id: 'e-e2', full_name: 'Mira Kulkarni', system_role: 'employee', is_active: false, manager_id: 'e-m1', email: 'mira.kulkarni@emids.com', emp_no: 'EM-30212', job_title: 'Analyst' }),
]

function renderPage(setToast = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ setToast, profile: { id: 'e-m1' } } as unknown as AuthContextValue}>
        <AdminContext.Provider value={{ reload: vi.fn() } as unknown as AdminContextValue}>
          <AdminRoster />
        </AdminContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return setToast
}

describe('pages/AdminRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAdminEmployees).mockResolvedValue({ page: { items: people(), total: 3 }, error: null })
  })

  afterEach(() => vi.restoreAllMocks())

  it('lists the whole company with manager names, newest joins first', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    const rows = screen.getAllByRole('row')
    expect(rows[1]?.textContent).toContain('Rhea Menon') // same doj → alphabetical first
    expect(rows.some((row) => row.textContent?.includes('Inactive'))).toBe(true)
  })

  it('filters by role chips', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Employees' }))
    expect(screen.queryByText('EM-30001')).not.toBeInTheDocument() // the manager row drops out
    expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument()
  })

  it('pages a long roster', async () => {
    const longList = Array.from({ length: 12 }, (_, index) =>
      person({ id: `e-p${index}`, full_name: `Person ${String(index).padStart(2, '0')}`, emp_no: `EM-4${String(index).padStart(4, '0')}` })
    )
    vi.mocked(fetchAdminEmployees).mockResolvedValue({ page: { items: longList, total: 12 }, error: null })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument()
    expect(screen.getByText('Person 11')).toBeInTheDocument()
    expect(screen.queryByText('Person 00')).not.toBeInTheDocument()
  })

  it('saves a role retune through the update endpoint', async () => {
    const user = userEvent.setup()
    vi.mocked(adminUpdateEmployee).mockResolvedValue({ employee: person(), error: null })
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    const row = screen.getAllByRole('row').find((row) => row.textContent?.includes('Vikram Deshmukh'))!
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    const title = screen.getByLabelText(/Job title/)
    await user.clear(title)
    await user.type(title, 'Senior Consultant')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(adminUpdateEmployee).toHaveBeenCalledWith(
        'e-e1',
        expect.objectContaining({ job_title: 'Senior Consultant', system_role: 'employee', manager_id: 'e-m1' })
      )
    )
    expect(adminSetEmployeeActive).not.toHaveBeenCalled()
  })

  it('runs the settled-team guard in the dialog before calling the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    await user.click(screen.getByTitle("Edit Rhea Menon's role, status or team"))
    await user.click(screen.getAllByRole('button', { name: 'employee' })[0])
    await user.type(screen.getByLabelText(/Job title/), 'QA Lead')
    // text spans <b>Blocked</b> + message inside the WarnBanner
    const banners = screen
      .getAllByText((content, element) => /active direct report/.test(element?.textContent ?? ''))
      .filter((node) => node.tagName === 'DIV')
    expect(banners.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(adminUpdateEmployee).not.toHaveBeenCalled()
  })
})
