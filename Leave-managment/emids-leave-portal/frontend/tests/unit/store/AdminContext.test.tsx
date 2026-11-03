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
import { AdminContext, AdminProvider, useAdmin } from '../../../src/store/AdminContext'
import { fetchAdminEmployees } from '../../../src/services/admin'

function Probe() {
  const { employees, total, loading, setSearch } = useAdmin()
  return (
    <div>
      <button type="button" onClick={() => setSearch('meera')}>search</button>
      <div data-testid="count">{loading ? 'loading' : String(total)}</div>
      <div data-testid="rows">{employees.length}</div>
    </div>
  )
}

describe('store/AdminContext', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  function setup(behavior: () => Promise<unknown>, setToast = vi.fn()) {
    vi.mocked(fetchAdminEmployees).mockImplementation(behavior as never)
    render(
      <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
        <AdminProvider>
          <Probe />
        </AdminProvider>
      </AuthContext.Provider>
    )
    return setToast
  }

  it('loads the employee page on mount', async () => {
    setup(() =>
      Promise.resolve({
        page: { rows: [{ id: 'e1' }, { id: 'e2' }], page: 1, page_size: 10, total: 2, page_count: 1 },
        error: null,
      })
    )
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(screen.getByTestId('rows')).toHaveTextContent('2')
  })

  it('debounces the search box into one paged server query', async () => {
    const user = userEvent.setup()
    setup(() =>
      Promise.resolve({
        page: { rows: [{ id: 'e1' }, { id: 'e2' }], page: 1, page_size: 10, total: 2, page_count: 1 },
        error: null,
      })
    )
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('2'))
    await user.click(screen.getByRole('button', { name: 'search' }))
    await waitFor(() => expect(fetchAdminEmployees).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'meera' })))
    expect(fetchAdminEmployees).toHaveBeenCalledTimes(2) // mount + the debounced search, no more
  })

  it('reports load failures through the shared toast and keeps the empty page', async () => {
    const setToast = setup(() =>
      Promise.resolve({ page: { rows: [], page: 1, page_size: 10, total: 0, page_count: 0 }, error: { code: 'unknown', context: 'admin employee lookup', userMessage: 'offline' } })
    )
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('offline', 'red'))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('survives a rejected fetch without crashing', async () => {
    setup(() => Promise.reject(new TypeError('Failed to fetch')))
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
    expect(screen.getByTestId('rows')).toHaveTextContent('0')
  })

  it('is isolated from AuthContext (separate provider)', () => {
    const setToast = vi.fn()
    render(
      <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
        <AdminContext.Provider value={null}>
          <div />
        </AdminContext.Provider>
      </AuthContext.Provider>
    )
    expect(setToast).not.toHaveBeenCalled()
  })
})
