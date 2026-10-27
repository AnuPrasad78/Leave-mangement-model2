import type { LeaveRequestRow } from '../../../src/types/models'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import LeaveDetails from '../../../src/pages/LeaveDetails'

const row = (id: string, status: string, extra: object = {}): LeaveRequestRow => ({
  id, mode: 'Full Day', type: 'Paid Time Off', from: '2026-03-02', to: '2026-03-06', days: 5,
  reason: 'Family trip', requestedOn: '2026-02-20', decidedOn: null, status: status as never, ...extra,
})

function setup({ mine, cancelMine = vi.fn(async () => {}) }: { mine?: LeaveRequestRow[]; cancelMine?: () => Promise<void> } = {}) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ mine: mine ?? [], cancelMine, CURRENT_YEAR: 2026 } as unknown as AuthContextValue}>
        <LeaveDetails />
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return cancelMine
}

describe('pages/LeaveDetails', () => {
  it('renders the head, the summary strip and the request-history table', () => {
    setup({ mine: [row('LV-1', 'Pending'), row('LV-2', 'Approved', { type: 'Work From Home' })] })
    expect(screen.getByText('Leave details.')).toBeInTheDocument()
    expect(screen.getByText('Request History')).toBeInTheDocument()
    expect(screen.getByText('LV-1')).toBeInTheDocument()
    expect(screen.getByText('LV-2')).toBeInTheDocument()
    expect(screen.getByText('2 ENTRIES · LV-FY2026')).toBeInTheDocument()
  })

  it('shows the empty copy when nothing has been raised yet', () => {
    setup({ mine: [] })
    expect(screen.getByText(/No requests on file\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Raise one' })).toHaveAttribute('href', '/apply-leave')
  })

  it('confirms the cancellation through the modal and calls the store helper', async () => {
    const user = userEvent.setup()
    const cancelMine = vi.fn(async () => {})
    setup({ mine: [row('LV-1', 'Pending')], cancelMine })

    await user.click(screen.getByTitle('Cancel request'))
    const dialog = screen.getByRole('dialog', { name: 'Cancel this request?' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(cancelMine).toHaveBeenCalledWith('LV-1'))
  })

  it('renders the cancel affordance only for pending rows', () => {
    setup({ mine: [row('LV-1', 'Pending'), row('LV-2', 'Approved')] })
    expect(screen.getByTitle('Cancel request')).toBeInTheDocument()
    expect(screen.queryAllByTitle('Cancel request')).toHaveLength(1)
  })

  it('opens the selected pending request and submits edited values', async () => {
    const user = userEvent.setup()
    const updateMine = vi.fn(async () => true)
    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            mine: [row('LV-1', 'Pending')],
            cancelMine: vi.fn(async () => {}),
            updateMine,
            leaveTypes: ['Paid Time Off'],
            balances: null,
            setToast: vi.fn(),
            CURRENT_YEAR: 2026,
          } as unknown as AuthContextValue}
        >
          <LeaveDetails />
        </AuthContext.Provider>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Edit request LV-1' }))
    expect(screen.getByLabelText(/From Date/)).toHaveValue('2026-03-02')
    await user.clear(screen.getByLabelText(/Reason/))
    await user.type(screen.getByLabelText(/Reason/), 'Updated family trip')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(updateMine).toHaveBeenCalledWith('LV-1', expect.objectContaining({
        from: '2026-03-02',
        to: '2026-03-06',
        reason: 'Updated family trip',
      }))
    )
  })
})
