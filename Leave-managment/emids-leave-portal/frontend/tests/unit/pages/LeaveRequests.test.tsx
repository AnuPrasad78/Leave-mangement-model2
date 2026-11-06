import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import type { TeamRequestRow } from '../../../src/types/models'
import LeaveRequests from '../../../src/pages/LeaveRequests'

const pending = (id: string, name: string) => ({
  id, mode: 'Full Day', name, empId: `EM-${id}`, absenceType: 'Paid Time Off',
  from: '2026-03-02', to: '2026-03-06', days: 5,
  reason: 'Family trip', requestedOn: '2026-02-20', status: 'Pending',
}) as unknown as TeamRequestRow
const approved = {
  id: 'LV-2', mode: 'Full Day', name: 'Decided Person', empId: 'EM-2', absenceType: 'Work From Home',
  from: '2026-04-01', to: '2026-04-01', days: 1,
  reason: 'Home setup', requestedOn: '2026-03-25', status: 'Approved',
} as unknown as TeamRequestRow

function setup({ team, decide = vi.fn(async () => {}), decideMany = vi.fn(async () => {}) }: { team?: TeamRequestRow[]; decide?: (id: string, decision: string) => Promise<void>; decideMany?: (ids: string[], decision: string) => Promise<void> } = {}) {
  const setToast = vi.fn()
  render(
    <AuthContext.Provider value={{ team: team ?? [], decide, decideMany, setToast } as unknown as AuthContextValue}>
      <LeaveRequests />
    </AuthContext.Provider>
  )
  return setToast
}

describe('pages/LeaveRequests', () => {
  it('renders the team-queue head and the pending queue by default', () => {
    setup({ team: [pending('LV-1', 'Report One'), approved] })
    expect(screen.getByText('Leave requests.')).toBeInTheDocument()
    expect(screen.getByText('Report One')).toBeInTheDocument()
    expect(screen.queryByText('Decided Person')).not.toBeInTheDocument() // Pending filter is the default
    expect(screen.getByRole('button', { name: 'APPROVE' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'REJECT' })).toBeInTheDocument()
  })

  it('shows every request after switching to the All filter', async () => {
    const user = userEvent.setup()
    setup({ team: [pending('LV-1', 'Report One'), approved] })
    await user.selectOptions(screen.getByLabelText('Filter requests by status'), 'All')
    expect(screen.getByText('Report One')).toBeInTheDocument()
    expect(screen.getByText('Decided Person')).toBeInTheDocument()
  })

  it('routes an APPROVE click through the store decide helper', async () => {
    const user = userEvent.setup()
    const decide = vi.fn(async () => {})
    setup({ team: [pending('LV-1', 'Report One')], decide })
    await user.click(screen.getByRole('button', { name: 'APPROVE' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('LV-1', 'Approved'))
  })

  it('surfaces a failed decision through the global error toast', async () => {
    const user = userEvent.setup()
    const decide = vi.fn(async () => {
      throw new Error('Not authorized to decide this request')
    })
    const setToast = setup({ team: [pending('LV-1', 'Report One')], decide })
    await user.click(screen.getByRole('button', { name: 'APPROVE' }))
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('Not authorized to decide this request', 'red'))
  })

  it('reports an empty queue when the team has no pending rows', () => {
    setup({ team: [approved] })
    expect(screen.queryByRole('button', { name: 'APPROVE' })).not.toBeInTheDocument()
  })
})
