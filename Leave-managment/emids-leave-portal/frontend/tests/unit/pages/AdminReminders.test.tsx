import { vi } from 'vitest'

vi.mock('../../../src/services/admin', () => ({
  adminSendNudge: vi.fn(),
  fetchAdminEmployees: vi.fn(),
  fetchOrgRequests: vi.fn(),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminReminders from '../../../src/pages/AdminReminders'
import { adminSendNudge, fetchAdminEmployees, fetchOrgRequests } from '../../../src/services/admin'
import type { EmployeeAdminRow, LeaveRequestSelectRow } from '../../../src/types/models'

const person = (overrides: Partial<EmployeeAdminRow> = {}): EmployeeAdminRow => ({
  id: 'e1',
  user_id: 'u1',
  emp_no: 'EM-30001',
  full_name: 'Rhea Menon',
  initials: 'RM',
  email: 'rhea.menon@emids.com',
  job_title: 'Delivery Manager',
  doj: null,
  account: null,
  project_name: null,
  function_name: null,
  manager_id: null,
  delivery_partner_name: null,
  location: null,
  system_role: 'manager',
  is_active: true,
  created_at: null,
  ...overrides,
} as EmployeeAdminRow)

const request = (overrides: Partial<LeaveRequestSelectRow> = {}): LeaveRequestSelectRow => ({
  request_no: 'LV-00007',
  employee_id: 'e9',
  leave_type_id: 1,
  start_date: '2026-11-20',
  end_date: '2026-11-21',
  days: 2,
  mode: 'Full Day',
  reason: 'family',
  status: 'Pending',
  approver_id: null,
  decided_at: null,
  requested_on: '2026-11-01',
  created_at: '2026-11-01',
  leave_types: { name: 'Annual' },
  employees: { full_name: 'Vikram Deshmukh', emp_no: 'EM-20810' },
  id: 7,
  ...overrides,
})

function renderPage(setToast = vi.fn()) {
  render(
    <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
      <AdminReminders />
    </AuthContext.Provider>
  )
  return setToast
}

describe('pages/AdminReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchOrgRequests).mockResolvedValue({
      rows: [
        request({ employee_id: 'e9', request_no: 'LV-00007', status: 'Pending', requested_on: '2026-11-01' }),
        request({ employee_id: 'e9', request_no: 'LV-00008', status: 'Pending', requested_on: '2026-10-28' }),
      ],
      error: null,
    })
    vi.mocked(fetchAdminEmployees).mockResolvedValue({
      page: {
        items: [
          person(),
          person({ id: 'e9', system_role: 'employee', full_name: 'Vikram Deshmukh', job_title: 'Consultant', manager_id: 'e1' }),
        ],
        total: 2,
      },
      error: null,
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('groups pending requests under the employees’ managers', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Rhea Menon')).toBeInTheDocument())
    const rows = screen.getAllByRole('row')
    expect(rows.some((row) => row.textContent?.includes('2'))).toBe(true)
  })

  it('sends the nudge to every picked manager', async () => {
    const user = userEvent.setup()
    vi.mocked(adminSendNudge).mockResolvedValue({ error: null })
    renderPage()
    await waitFor(() => expect(screen.getByText('Rhea Menon')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Nudge' }))
    const subject = screen.getByLabelText('Subject') as HTMLInputElement
    await user.clear(subject)
    await user.type(subject, 'Review queue')
    const message = screen.getByLabelText('Message') as HTMLTextAreaElement
    await user.clear(message)
    await user.type(message, 'Two requests are waiting.')
    await user.click(screen.getByRole('button', { name: 'Send nudge' }))
    await waitFor(() =>
      expect(adminSendNudge).toHaveBeenCalledWith({
        recipient_employee_ids: ['e1'],
        title: 'Review queue',
        body: 'Two requests are waiting.',
      })
    )
  })

  it('refuses to send without copy', async () => {
    const user = userEvent.setup()
    const setToast = renderPage()
    await waitFor(() => expect(screen.getByText('Rhea Menon')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Nudge' }))
    const subject = screen.getByLabelText('Subject') as HTMLInputElement
    await user.clear(subject)
    const message = screen.getByLabelText('Message') as HTMLTextAreaElement
    await user.clear(message)
    await user.click(screen.getByRole('button', { name: 'Send nudge' }))
    expect(adminSendNudge).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(setToast).toHaveBeenCalledWith(expect.stringMatching(/Subject and message/), 'red')
    )
  })

  it('pre-fills the composer copy from the queue once loaded', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveValue('2 pending leave decisions waiting'))
  })
})
