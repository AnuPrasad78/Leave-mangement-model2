import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../../src/services/separations', () => ({
  createSeparationRequest: vi.fn(),
}))

import { createSeparationRequest } from '../../../src/services/separations'
import { AuthContext } from '../../../src/store/AuthContext'
import SeparationRequest from '../../../src/pages/SeparationRequest'

function setup({ setToast = vi.fn(), profile = { id: 'e-me' } } = {}) {
  return render(
    <MemoryRouter initialEntries={['/separation-request']}>
      <AuthContext.Provider value={{ setToast, profile }}>
        <Routes>
          <Route path='/separation-request' element={<SeparationRequest />} />
          <Route path='/dashboard' element={<div>dashboard-here</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

function fillLwd(value) {
  fireEvent.change(screen.getByLabelText(/Last Working Day/), { target: { value } })
}

describe('pages/SeparationRequest', () => {
  beforeEach(() => {
    vi.mocked(createSeparationRequest).mockReset()
  })

  it('requires a last working day and a reason', async () => {
    const user = userEvent.setup()
    const setToast = vi.fn()
    setup({ setToast })
    await user.click(screen.getByRole('button', { name: 'Submit Separation Request' }))
    expect(screen.getByText('Pick your proposed last working day.')).toBeInTheDocument()
    expect(screen.getByText('Select a reason for separation.')).toBeInTheDocument()
    expect(createSeparationRequest).not.toHaveBeenCalled()
    expect(setToast).not.toHaveBeenCalled()
  })

  it('rejects a last working day in the past', async () => {
    const user = userEvent.setup()
    setup()
    fillLwd('2001-01-01')
    await user.selectOptions(screen.getByLabelText(/Reason for Separation/), 'Higher Studies')
    await user.click(screen.getByRole('button', { name: 'Submit Separation Request' }))
    expect(screen.getByText('Last working day must be in the future.')).toBeInTheDocument()
    expect(createSeparationRequest).not.toHaveBeenCalled()
  })

  it('opens the confirm dialog, then submits the normalized payload and routes back', async () => {
    const user = userEvent.setup()
    vi.mocked(createSeparationRequest).mockResolvedValue({ error: null })
    const setToast = vi.fn()
    setup({ setToast, profile: { id: 'e-me' } })

    fillLwd('2099-01-01')
    await user.selectOptions(screen.getByLabelText(/Reason for Separation/), 'Higher Studies')
    fireEvent.change(screen.getByLabelText(/Remarks/), { target: { value: 'Handover to senior' } })
    await user.click(screen.getByRole('button', { name: 'Submit Separation Request' }))

    expect(screen.getByRole('dialog', { name: 'Raise separation request?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm & notify HR' }))

    await waitFor(() =>
      expect(createSeparationRequest).toHaveBeenCalledWith({
        employee_id: 'e-me',
        last_working_day: '2099-01-01',
        reason: 'Higher Studies',
        remarks: 'Handover to senior',
      })
    )
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Separation request raised · HR notified'))
    await waitFor(() => expect(screen.getByText('dashboard-here')).toBeInTheDocument())
  })
})
