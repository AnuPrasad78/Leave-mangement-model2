import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { STATUSES } from '../../../../../src/constants'
import LeaveRequestQueue from '../../../../../src/components/feature/leave-request-queue/LeaveRequestQueue'

const team = [
  { id: 'LV-1', name: 'Ravi Menon', empId: 'EM-1001', absenceType: 'Paid Time Off', from: '2026-11-02', to: '2026-11-04', days: 3, reason: 'Family function in Salem', requestedOn: '2026-10-01', status: STATUSES.Pending },
  { id: 'LV-2', name: 'Sara Iyer', empId: 'EM-1002', absenceType: 'Work From Home', from: '2026-11-10', to: '2026-11-10', days: 1, reason: 'Home broadband outage', requestedOn: '2026-10-02', status: STATUSES.Approved },
]

function setup({ decide = vi.fn(async () => undefined), decideMany = vi.fn(async () => undefined), team: rows = team } = {}) {
  render(<LeaveRequestQueue team={rows} decide={decide} decideMany={decideMany} />)
  return { decide, decideMany }
}

describe('components/feature/LeaveRequestQueue', () => {
  it('renders the pinned filter row and team request columns', () => {
    setup()
    expect(screen.getByLabelText('Filter requests by status')).toBeInTheDocument()
    expect(screen.getByText('Ravi Menon')).toBeInTheDocument()
    expect(screen.getByText('EM-1001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'APPROVE' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REJECT' })).toBeInTheDocument()
    expect(screen.queryByText('NO ACTION')).not.toBeInTheDocument() // Pending filter hides decided rows
  })

  it('shows the pending filter selected with its count', () => {
    setup()
    const select = screen.getByLabelText('Filter requests by status')
    expect(select.value).toBe(STATUSES.Pending)
    expect(within(select).getByRole('option', { name: 'Pending (1)' }).selected).toBe(true)
    expect(within(select).getByRole('option', { name: 'All' })).toBeInTheDocument()
  })

  it('decides a single request through decide with the picked status', async () => {
    const user = userEvent.setup()
    const { decide } = setup()
    await user.click(screen.getByRole('button', { name: 'APPROVE' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('LV-1', STATUSES.Approved))

    await user.click(screen.getByRole('button', { name: 'REJECT' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('LV-1', STATUSES.Rejected))
  })

  it('hides approve-all while fewer than two requests are pending', () => {
    setup()
    expect(screen.queryByRole('button', { name: /APPROVE ALL/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 ENTRIES')).toBeInTheDocument()
  })

  it('offers and executes approve-all for two or more pending requests', async () => {
    const user = userEvent.setup()
    const { decideMany } = setup({
      team: [...team, { ...team[0], id: 'LV-3', name: 'Tara Bose', empId: 'EM-1003', status: STATUSES.Pending }],
    })
    const bulk = screen.getByRole('button', { name: 'APPROVE ALL (2)' })
    await user.click(bulk)
    await waitFor(() => expect(decideMany).toHaveBeenCalledWith(['LV-1', 'LV-3'], STATUSES.Approved))
  })

  it('filters the queue by status through the select', async () => {
    const user = userEvent.setup()
    setup()
    await user.selectOptions(screen.getByLabelText('Filter requests by status'), 'All')
    expect(screen.getByText('2 ENTRIES')).toBeInTheDocument()
    expect(screen.getByText('Sara Iyer')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filter requests by status'), STATUSES.Approved)
    expect(screen.getByText('1 ENTRIES')).toBeInTheDocument()
  })
})
