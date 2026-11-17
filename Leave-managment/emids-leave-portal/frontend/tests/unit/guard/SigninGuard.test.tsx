import { AuthContext, type AuthContextValue } from '../../../store/AuthContext'
import { render, screen, waitFor } from '@testing-library/react'
import SigninGuard from '../../../app/lib/security/SigninGuard'

const replace = vi.fn()

beforeEach(() => {
  replace.mockClear()
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('../../../app/components/organisms/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-stub">{children}</div>,
}))

const EMPLOYEE_PROFILE = { system_role: 'employee' }
const MANAGER_PROFILE = { system_role: 'manager' }
const ADMIN_PROFILE = { system_role: 'admin' }

function setup({
  signedIn = true,
  authReady = true,
  profile = undefined,
  require,
}: {
  signedIn?: boolean
  authReady?: boolean
  profile?: unknown
  require?: 'manager' | 'admin'
}) {
  return render(
    <AuthContext.Provider
      value={{ signedIn, authReady, profile } as unknown as AuthContextValue}
    >
      <SigninGuard require={require}>guards-page</SigninGuard>
    </AuthContext.Provider>
  )
}

describe('guard/SigninGuard', () => {
  it('renders nothing while the session is still restoring', () => {
    setup({ authReady: false, signedIn: false })
    expect(screen.queryByText('guards-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replaces to /login when signed out', async () => {
    setup({ signedIn: false })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  it('renders children inside Layout when signed in with no extra role required', () => {
    setup({ profile: EMPLOYEE_PROFILE })
    expect(screen.getByText('guards-page')).toBeInTheDocument()
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replaces employees to /dashboard when the manager gate is required', async () => {
    setup({ profile: EMPLOYEE_PROFILE, require: 'manager' })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('lets managers through the manager gate', () => {
    setup({ profile: MANAGER_PROFILE, require: 'manager' })
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('replaces managers to /dashboard when the admin gate is required', async () => {
    setup({ profile: MANAGER_PROFILE, require: 'admin' })
    expect(screen.queryByTestId('layout-stub')).not.toBeInTheDocument()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('lets admins through the admin gate', () => {
    setup({ profile: ADMIN_PROFILE, require: 'admin' })
    expect(screen.getByTestId('layout-stub')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
