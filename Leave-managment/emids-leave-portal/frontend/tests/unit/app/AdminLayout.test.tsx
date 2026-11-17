import { AuthContext, type AuthContextValue } from '../../../store/AuthContext'
import { render, screen, waitFor } from '@testing-library/react'
import AdminLayout from '../../../app/(admin)/layout'

const replace = vi.fn()
const setToast = vi.fn()

vi.mock('../../../services/admin', () => ({
  fetchAdminEmployees: vi.fn(),
  adminCreateEmployee: vi.fn(),
  adminUpdateEmployee: vi.fn(),
  adminSetEmployeeActive: vi.fn(),
  adminInitPasswordReset: vi.fn(),
}))

import { fetchAdminEmployees } from '../../../services/admin'

beforeEach(() => {
  replace.mockClear()
  vi.mocked(fetchAdminEmployees).mockReset()
  vi.mocked(fetchAdminEmployees).mockResolvedValue({
    page: { rows: [], page: 1, page_size: 10, total: 0, page_count: 1 },
    error: null,
  })
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('../../../app/components/organisms/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-stub">{children}</div>,
}))

const EMPLOYEE_PROFILE = { system_role: 'employee' }
const MANAGER_PROFILE = { system_role: 'manager' }
const ADMIN_PROFILE = { system_role: 'admin', id: 'adm-1' }


function renderAdmin(children: React.ReactNode = 'admin-page') {
  return render(
    <AuthContext.Provider value={{ signedIn: true, authReady: true, profile: ADMIN_PROFILE, setToast } as unknown as AuthContextValue}>
      <AdminLayout>{children}</AdminLayout>
    </AuthContext.Provider>
  )
}

/* Hierarchy is the guard → Layout stub (real Layout renders inside the guard)
 * → AdminProvider → page; AdminProvider never mounts for non-admin access. */
describe('app/(admin) layout', () => {
  it('replaces signed-out access to /login and never mounts AdminProvider', async () => {
    const { unmount } = render(
      <AuthContext.Provider value={{ signedIn: false, authReady: true, profile: null, setToast } as unknown as AuthContextValue}>
        <AdminLayout>blocked</AdminLayout>
      </AuthContext.Provider>
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    expect(fetchAdminEmployees).not.toHaveBeenCalled()
    unmount()
  })

  it('replaces employees to /dashboard and mounts no AdminProvider', async () => {
    const { unmount } = render(
      <AuthContext.Provider value={{ signedIn: true, authReady: true, profile: EMPLOYEE_PROFILE, setToast } as unknown as AuthContextValue}>
        <AdminLayout>blocked</AdminLayout>
      </AuthContext.Provider>
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    expect(fetchAdminEmployees).not.toHaveBeenCalled()
    unmount()
  })

  it('replaces managers to /dashboard and mounts no AdminProvider', async () => {
    const { unmount } = render(
      <AuthContext.Provider value={{ signedIn: true, authReady: true, profile: MANAGER_PROFILE, setToast } as unknown as AuthContextValue}>
        <AdminLayout>blocked</AdminLayout>
      </AuthContext.Provider>
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
    expect(fetchAdminEmployees).not.toHaveBeenCalled()
    unmount()
  })

  it('mounts AdminProvider for admins: children render under the Layout and the employee table loads', async () => {
    const { unmount } = renderAdmin()
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(screen.getByText('admin-page')).toBeInTheDocument()
    await waitFor(() => expect(fetchAdminEmployees).toHaveBeenCalledTimes(1))
    unmount()
  })

  it('keeps AdminProvider mounted when the page body inside the group changes', async () => {
    const first = renderAdmin('dashboard-page')
    await waitFor(() => expect(fetchAdminEmployees).toHaveBeenCalledTimes(1))
    // Swap to the next admin page: the group layout instance must persist
    // (same tree position), so AdminProvider must NOT re-run its boot fetch.
    first.rerender(
      <AuthContext.Provider value={{ signedIn: true, authReady: true, profile: ADMIN_PROFILE, setToast } as unknown as AuthContextValue}>
        <AdminLayout>employees-page</AdminLayout>
      </AuthContext.Provider>
    )
    expect(screen.getByText('employees-page')).toBeInTheDocument()
    expect(fetchAdminEmployees).toHaveBeenCalledTimes(1)
    first.unmount()
  })

  it('unmounts AdminProvider with the group (fresh boot fetch on the next admin visit)', async () => {
    const first = renderAdmin()
    await waitFor(() => expect(fetchAdminEmployees).toHaveBeenCalledTimes(1))
    first.unmount()

    const second = renderAdmin()
    await waitFor(() => expect(fetchAdminEmployees).toHaveBeenCalledTimes(2))
    second.unmount()
  })
})
