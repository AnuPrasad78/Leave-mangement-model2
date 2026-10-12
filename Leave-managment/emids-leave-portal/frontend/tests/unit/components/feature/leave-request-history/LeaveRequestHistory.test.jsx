import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { STATUSES } from '../../../../../src/constants'
import LeaveRequestHistory from '../../../../../src/components/feature/leave-request-history/LeaveRequestHistory'

const mine = [
  { id: 'LV-1', type: 'Compensatory Off', from: '2026-11-02', to: '2026-11-03', days: 2, reason: 'Comp for festival weekend', requestedOn: '2026-10-01', status: STATUSES.Pending },
  { id: 'LV-2', type: 'Paid Time Off', from: '2026-12-02', to: '2026-12-04', days: 3, reason: 'Winter break with family', requestedOn: '2026-10-02', status: STATUSES.Approved },
  { id: 'LV-3', type: 'Work From Home', from: '2026-12-10', to: '2026-12-10', days: 1, reason: 'Home broadband outage', requestedOn: '2026-10-03', status: STATUSES.Rejected },
]

function setup({ cancelMine = vi.fn(async () => undefined), mine: rows = mine } = {}) {
  render(
    <MemoryRouter>
      <LeaveRequestHistory mine={rows} cancelMine={cancelMine} yearLabel="2026" />
    </MemoryRouter>
  )
  return { cancelMine }
}

describe('components/feature/LeaveRequestHistory', () => {
  it('renders the summary strip with quick labels and an Other bucket', () => {
    setup()
    const strip = document.querySelector('.strip')
    expect(strip).toBeInTheDocument()
    expect(strip).toHaveAttribute('aria-label', 'Summary')
    const cells = document.querySelectorAll('.strip__cell')
    expect(cells).toHaveLength(5)
    expect(within(strip).getByText('Comp-Off')).toBeInTheDocument()
    expect(within(strip).getByText('WFH')).toBeInTheDocument()
    expect(within(strip).getByText('Business Travel')).toBeInTheDocument()
    expect(within(strip).getByText('Paternity')).toBeInTheDocument()
    expect(within(strip).getByText('Leave')).toBeInTheDocument()
    // Leave"=1 (Paid Time Off falls to the shared bucket), Comp-Off=1, WFH=1, the rest 0
    expect(within(cells[0]).getByText('1')).toBeInTheDocument()
    expect(within(cells[1]).getByText('1')).toBeInTheDocument()
    expect(within(cells[2]).getByText('1')).toBeInTheDocument()
    expect(within(cells[3]).getByText('0')).toBeInTheDocument()
    expect(within(cells[4]).getByText('0')).toBeInTheDocument()
  })

  it('renders the request history table with the year label', () => {
    setup()
    expect(screen.getByText('3 ENTRIES · LV-FY2026')).toBeInTheDocument()
    expect(screen.getByText('LV-1')).toBeInTheDocument()
    expect(screen.getByText('Comp-Off')).toBeInTheDocument()
    expect(screen.getAllByText('04 Dec 2026').length).toBeGreaterThan(0) // fmtDate of LV-2 to-date
  })

  it('offers cancel only for pending requests', () => {
    setup()
    expect(screen.getByTitle('Cancel request')).toBeInTheDocument()
    expect(screen.getAllByTitle('Cancel request')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument()
  })

  it('falls back with a raise-one link when there are no requests', () => {
    setup({ mine: [] })
    expect(screen.getByText(/No requests on file\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Raise one' })).toBeInTheDocument()
  })

  it('opens and confirms the cancel modal against cancelMine', async () => {
    const user = userEvent.setup()
    const { cancelMine } = setup()
    await user.click(screen.getByTitle('Cancel request'))
    const dialog = screen.getByRole('dialog', { name: 'Cancel this request?' })
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel request' }))
    expect(cancelMine).toHaveBeenCalledWith('LV-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the modal without cancelling on Close', async () => {
    const user = userEvent.setup()
    const { cancelMine } = setup()
    await user.click(screen.getByTitle('Cancel request'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(cancelMine).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
