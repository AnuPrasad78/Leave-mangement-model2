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
import type { EmployeeAdminRow, Paginated } from '../../../src/types/models'
import type { EmployeeLookup } from '../../../src/services/admin'

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
  manager_name: null,
  ...overrides,
})

const people = () => [
  person({ manager_name: null }),
  person({ id: 'e-e1', full_name: 'Vikram Deshmukh', system_role: 'employee', manager_id: 'e-m1', email: 'vikram.deshmukh@emids.com', emp_no: 'EM-30211', job_title: 'Consultant', manager_name: 'Rhea Menon' }),
  person({ id: 'e-e2', full_name: 'Mira Kulkarni', system_role: 'employee', is_active: false, manager_id: 'e-m1', email: 'mira.kulkarni@emids.com', emp_no: 'EM-30212', job_title: 'Analyst', manager_name: 'Rhea Menon' }),
]

const env = (rows: EmployeeAdminRow[], page = 1, total?: number): { page: Paginated<EmployeeAdminRow>; error: null } => ({
  page: { rows, page, page_size: 10, total: total ?? rows.length, page_count: Math.ceil((total ?? rows.length) / 10) },
  error: null,
})

/**
 * The single seam the roster talks to. Three request shapes share the one
 * endpoint: the board (sorted page), the bounded manager list, and a
 * person's report rows for the settled-team guard.
 */
function mockApi(fixture: EmployeeAdminRow[] = people()) {
  // one keyed implementation per lookup input; `pageSize: 100` and sorted
  // board calls never collide because the page caps its helper reads at 100
  // and never sorts them
  vi.mocked(fetchAdminEmployees).mockImplementation(async (input) => {
    const lookup = { ...(input ?? {}) } as EmployeeLookup & { page?: number; pageSize?: number }
    if (lookup.managerId !== undefined && !lookup.sort) {
      const directs = fixture.filter((p) => p.manager_id === lookup.managerId)
      return env(directs)
    }
    if (lookup.role === 'manager' && !lookup.sort) {
      const managers = fixture.filter((p) => p.system_role === 'manager' && p.is_active)
      return env(managers)
    }
    // the board: filters, sort and page live server-side now
    let rows = fixture
    if (lookup.role) rows = rows.filter((p) => p.system_role === lookup.role)
    if (lookup.active !== undefined) rows = rows.filter((p) => p.is_active === lookup.active)
    if (lookup.managerId) rows = rows.filter((p) => p.manager_id === lookup.managerId)
    if (lookup.search) {
      const query = lookup.search.toLowerCase()
      rows = rows.filter(
        (p) => p.full_name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query) || p.emp_no.toLowerCase().includes(query)
      )
    }
    rows = [...rows].sort((a, b) => (b.doj ?? '').localeCompare(a.doj ?? '') || a.full_name.localeCompare(b.full_name))
    const page = lookup.page ?? 1
    const start = (page - 1) * 10
    return env(rows.slice(start, start + 10), page, rows.length)
  })
}

function renderPage(setToast = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ setToast, profile: { id: 'e-admin' } } as unknown as AuthContextValue}>
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
    mockApi()
  })

  afterEach(() => vi.restoreAllMocks())

  it("lists the server's first page with resolved manager names", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    const rows = screen.getAllByRole('row')
    expect(rows.some((row) => row.textContent?.includes('Inactive'))).toBe(true)
    const vikram = screen.getByText('Vikram Deshmukh').closest('tr')
    expect(vikram?.textContent).toContain('Rhea Menon') // manager_name from the API
  })

  it('sends the role filter to the server instead of slicing locally', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Employees' }))
    await waitFor(() =>
      expect(
        vi.mocked(fetchAdminEmployees).mock.calls.some((call) => (call[0] as EmployeeLookup).role === 'employee')
      ).toBe(true)
    )
  })

  it('switches pages over the network, not by slicing', async () => {
    const user = userEvent.setup()
    mockApi(
      Array.from({ length: 12 }, (_, index) =>
        person({ id: `e-p${index}`, full_name: `Person ${String(index).padStart(2, '0')}`, emp_no: `EM-4${String(index).padStart(4, '0')}` })
      )
    )
    renderPage()
    await waitFor(() => expect(screen.getByText(/^Page 1 of 2/)).toBeInTheDocument())
    const pageOneCalls = vi.mocked(fetchAdminEmployees).mock.calls.length
    expect(screen.getByText('Person 09')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await waitFor(() => expect(screen.getByText(/^Page 2 of 2/)).toBeInTheDocument())
    // a NEW network request carried page 2
    expect(
      vi.mocked(fetchAdminEmployees).mock.calls.some((call) => (call[0] as EmployeeLookup & { page?: number }).page === 2)
    ).toBe(true)
    expect(screen.getByText('Person 10')).toBeInTheDocument()
    expect(screen.queryByText('Person 00')).not.toBeInTheDocument()
    expect(vi.mocked(fetchAdminEmployees).mock.calls.length).toBeGreaterThan(pageOneCalls)
  })

  it('debounces search into one server query', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    const before = vi.mocked(fetchAdminEmployees).mock.calls.length
    await user.type(screen.getByLabelText('Find a person'), 'vikram')
    await waitFor(() =>
      expect(
        vi.mocked(fetchAdminEmployees).mock.calls.some((call) => (call[0] as EmployeeLookup).search === 'vikram')
      ).toBe(true)
    )
    // one debounced request, not one per keystroke
    expect(vi.mocked(fetchAdminEmployees).mock.calls.length).toBeLessThanOrEqual(before + 2)
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

  it('runs the settled-team guard from fetched report rows', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    await user.click(screen.getByTitle("Edit Rhea Menon's role, status or team"))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled())
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
