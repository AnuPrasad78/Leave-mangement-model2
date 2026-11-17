import { AuthContext, type AuthContextValue } from '../../../store/AuthContext'
import { render, screen, waitFor } from '@testing-library/react'
import ManagerLayout from '../../../app/(manager)/layout'

const replace = vi.fn()

beforeEach(() => {
  replace.mockClear()
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('../../../app/components/organisms/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout-stub">{children}</div>
  ),
}))

const EMPLOYEE_PROFILE = { system_role: 'employee' }
const MANAGER_PROFILE = { system_role: 'manager' }
const ADMIN_PROFILE = { system_role: 'admin' }

function setup({
  signedIn = true,
  authReady = true,
  profile = undefined,
}: {
  signedIn?: boolean
  authReady?: boolean
  profile?: unknown
}) {
  return render(
    <AuthContext.Provider value={{ signedIn, authReady, profile } as unknown as AuthContextValue}>
      <ManagerLayout>queue-page</ManagerLayout>
    </AuthContext.Provider>
  )
}

/* The (manager) group mounts a fresh Layout singleton via SigninGuard
 * require="manager" — mirrors ManagerOnly in src/App.tsx. */
describe('app/(manager) layout', () => {
  it('renders nothing while the session is restoring', () => {
    setup({ authReady: false, signedIn: false })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replaces signed-out access to /login', async () => {
    setup({ signedIn: false })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  it('replaces employees to /dashboard', async () => {
    setup({ profile: EMPLOYEE_PROFILE })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('renders managers inside the manager Layout', () => {
    setup({ profile: MANAGER_PROFILE })
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(screen.getByText('queue-page')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('renders admins inside the manager Layout (canApprove semantics)', () => {
    setup({ profile: ADMIN_PROFILE })
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(screen.getByText('queue-page')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
