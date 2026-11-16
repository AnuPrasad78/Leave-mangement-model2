import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockNextNavigation, mockRouter } from '../mocks/nextNavigation'
import Login from '../../../src/pages/Login'

vi.mock('next/navigation', () => mockNextNavigation())

// The role-based redirect needs a profile: employees/managers land on the
// dashboard, admins on the admin console.
const EMPLOYEE_PROFILE = { system_role: 'employee' }
const ADMIN_PROFILE = { system_role: 'admin' }

function setup({ signedIn = false, signIn = vi.fn(async () => null as string | null), profile }: { signedIn?: boolean; signIn?: (email: string, password: string) => Promise<string | null>; profile?: unknown } = {}) {
  return render(
    <AuthContext.Provider value={{ signedIn, signIn, profile: profile ?? (signedIn ? EMPLOYEE_PROFILE : null) } as unknown as AuthContextValue}>
      <Login />
    </AuthContext.Provider>
  )
}

describe('pages/Login', () => {
  it('renders the pinned brand and form mark-up', () => {
    setup()
    expect(screen.getByText('Leave Management Portal')).toBeInTheDocument()
    expect(screen.getByLabelText(/Corporate Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign in/ })).toBeInTheDocument()
  })

  it('routes to the dashboard when already signed in', async () => {
    setup({ signedIn: true })
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('routes admins to the admin console when already signed in', async () => {
    setup({ signedIn: true, profile: ADMIN_PROFILE })
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin'))
  })

  it('surfaces the sign-in error next to the password field and trims the email', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn(async () => 'Invalid login credentials')
    setup({ signIn })

    await user.type(screen.getByLabelText(/Corporate Email/), '  sai.nithinreddy@emids.com ')
    await user.type(screen.getByLabelText(/Password/), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('sai.nithinreddy@emids.com', 'wrong-pass'))
    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeInTheDocument())
  })
})
