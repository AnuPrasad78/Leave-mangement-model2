import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from '../../../src/pages/Login'

function setup({ signedIn = false, signIn = vi.fn(async () => null as string | null) }: { signedIn?: boolean; signIn?: (email: string, password: string) => Promise<string | null> } = {}) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={{ signedIn, signIn } as unknown as AuthContextValue}>
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='/dashboard' element={<div>dashboard-here</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
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

  it('routes to the dashboard when already signed in', () => {
    setup({ signedIn: true })
    expect(screen.getByText('dashboard-here')).toBeInTheDocument()
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
