import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import ApplyLeave from '../../../src/pages/ApplyLeave'

const leaveTypes = ['Paid Time Off', 'Work From Home']
const balances = { totalCredited: 20, utilized: 5, rows: [{ key: 'available', label: 'Available', value: 15, max: 18 }] }

function setup({ addMine = vi.fn(async () => 'LV-100'), balances: b = balances, leaveTypes: types = leaveTypes } = {}) {
  const setToast = vi.fn()
  render(
    <MemoryRouter initialEntries={['/apply-leave']}>
      <AuthContext.Provider value={{ setToast, addMine, leaveTypes: types, balances: b } as unknown as AuthContextValue}>
        <Routes>
          <Route path='/apply-leave' element={<ApplyLeave />} />
          <Route path='/dashboard' element={<div>dashboard-here</div>} />
          <Route path='/leave-details' element={<div>leave-details-here</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return setToast
}

describe('pages/ApplyLeave', () => {
  it('renders the page head and the form with leave-type chips', () => {
    setup()
    expect(screen.getByText('Request time off.')).toBeInTheDocument()
    expect(document.querySelector('.form-card')).toBeInTheDocument()
    for (const t of leaveTypes) expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('navigates to the dashboard when the form is cancelled', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('dashboard-here')).toBeInTheDocument()
  })

  it('toasts the confirmation and routes to My Requests after a submitted request', async () => {
    const user = userEvent.setup()
    const setToast = setup({ addMine: vi.fn(async () => 'LV-100') })
    fireEvent.change(screen.getByLabelText(/From Date/), { target: { value: '2026-10-12' } })
    fireEvent.change(screen.getByLabelText(/To Date/), { target: { value: '2026-10-13' } })
    await user.type(screen.getByLabelText(/Reason/), 'Cousin wedding out of town')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    await waitFor(() => expect(screen.getByText('leave-details-here')).toBeInTheDocument())
    await waitFor(() => expect(setToast.mock.calls.at(-1)![0]).toBe('Paid Time Off request submitted · 2 day(s)'))
  })

  it('routes a form failure through the global error toast', async () => {
    const user = userEvent.setup()
    const setToast = setup({
      addMine: vi.fn(async () => {
        throw new Error('Unknown or inactive leave type')
      }),
    })
    fireEvent.change(screen.getByLabelText(/From Date/), { target: { value: '2026-10-12' } })
    fireEvent.change(screen.getByLabelText(/To Date/), { target: { value: '2026-10-13' } })
    await user.type(screen.getByLabelText(/Reason/), 'Cousin wedding out of town')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Unknown or inactive leave type', 'red'))
    expect(screen.queryByText('leave-details-here')).toBeNull()
  })

  it('disables the Overdrawn-balance CTA by not rendering a submit path (overdrawn blocks new asks)', () => {
    setup({
      balances: { totalCredited: 5, utilized: 8, rows: [{ key: 'available', label: 'Available', value: 0, max: 18 }] },
    })
    const btn = screen.getByRole('button', { name: 'Submit Request' })
    expect(btn).toBeDisabled()
  })
})
