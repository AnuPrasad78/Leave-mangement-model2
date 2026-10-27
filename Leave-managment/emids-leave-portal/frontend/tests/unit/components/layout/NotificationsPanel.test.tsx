import { render, screen, fireEvent } from '@testing-library/react'
import NotificationsPanel from '../../../../src/components/layout/NotificationsPanel'
import { buildNotifications } from '../../../../src/features/notifications/buildNotifications'
import { STATUSES } from '../../../../src/constants'
import type { LeaveRequestRow, TeamRequestRow } from '../../../../src/types/models'
import type { NotificationItem } from '../../../../src/features/notifications/buildNotifications'

const mineRow = (over: Partial<LeaveRequestRow> = {}): LeaveRequestRow => ({
  id: 'LV-2026-00001',
  type: 'Annual Leave',
  from: '2026-11-02',
  to: '2026-11-04',
  days: 3,
  mode: 'Full Day',
  reason: 'Family function',
  requestedOn: '2026-10-01',
  decidedOn: null,
  status: STATUSES.Pending,
  ...over,
})

const teamRow = (over: Partial<TeamRequestRow> = {}): TeamRequestRow => ({
  ...mineRow(),
  name: 'Priya Nair',
  empId: 'EM-20440',
  absenceType: 'Annual Leave',
  ...over,
})

const managerItems: NotificationItem[] = buildNotifications(
  { system_role: 'manager' },
  [
    mineRow({ id: 'LV-ME-1', status: STATUSES.Approved, decidedOn: '2026-10-25T10:00:00+00:00' }),
    mineRow({ id: 'LV-ME-2', status: STATUSES.Rejected, decidedOn: '2026-10-24T10:00:00+00:00' }),
  ],
  [
    teamRow(),
    teamRow({ id: 'LV-TEAM-1', name: 'Ashok Verma', empId: 'EM-20450', absenceType: 'Work From Home', requestedOn: '2026-10-03' }),
  ]
)

function setup({
  notifications = managerItems,
  onNavigate = vi.fn(),
  onDismiss = vi.fn(),
} = {}) {
  const view = render(
    <NotificationsPanel notifications={notifications} onNavigate={onNavigate} onDismiss={onDismiss} />
  )
  return { onNavigate, onDismiss, ...view }
}

describe('layout/NotificationsPanel', () => {
  it('renders the dialog semantics with the branded top bar', () => {
    setup()
    const pop = document.querySelector('.notif-pop')
    expect(pop).toHaveAttribute('role', 'dialog')
    expect(pop).toHaveAttribute('aria-label', 'Notifications')
    expect(document.querySelector('.pop-bar')).toBeInTheDocument()
    expect(document.querySelector('.pop-backdrop')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('lists approvals first with the approver, owner and route to the queue', () => {
    const { onNavigate } = setup()
    expect(screen.getByText('Priya Nair — Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('Ashok Verma — Work From Home')).toBeInTheDocument()
    const approvalRow = screen.getByText('Priya Nair — Annual Leave').closest('.notif-item')!
    expect(approvalRow.getAttribute('class')).toContain('notif-item--approval')
    fireEvent.click(approvalRow)
    expect(onNavigate).toHaveBeenCalledWith('/leave-requests')
  })

  it('shows decisions with their status pill and routes to the request history', () => {
    const { onNavigate } = setup()
    const decisionRow = screen.getByText('LV-ME-1 — Annual Leave').closest('.notif-item')!
    fireEvent.click(decisionRow)
    expect(onNavigate).toHaveBeenCalledWith('/leave-details')
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('dismisses on Escape, outside mousedown, and the explicit close control', () => {
    const { onDismiss } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }))
    expect(onDismiss).toHaveBeenCalledTimes(2)

    onDismiss.mockClear()
    fireEvent.mouseDown(document.querySelector('.notif-pop')!)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('shows the caught-up state when there is nothing actionable', () => {
    setup({ notifications: [] })
    expect(screen.getByText('You’re all caught up.')).toBeInTheDocument()
    expect(screen.queryByText(/— Annual Leave/)).toBeNull()
  })
})
