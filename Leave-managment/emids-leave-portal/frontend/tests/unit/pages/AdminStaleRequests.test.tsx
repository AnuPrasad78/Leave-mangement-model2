import { vi } from 'vitest'

vi.mock('../../../src/services/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/admin')>()
  return { ...actual, fetchStaleRequests: vi.fn() }
})
vi.mock('../../../src/services/leaveRequests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/leaveRequests')>()
  return { ...actual, decide: vi.fn() }
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminStaleRequests from '../../../src/pages/AdminStaleRequests'
import { fetchStaleRequests } from '../../../src/services/admin'
import { decide } from '../../../src/services/leaveRequests'
import { todayISO } from '../../../src/utils/dates'
import type { StaleRequestRow } from '../../../src/types/models'

const stale = (overrides: Partial<StaleRequestRow> = {}): StaleRequestRow => ({
  request_no: 'LV-00003',
  employee_id: 'e9',
  start_date: '2026-10-30',
  end_date: '2026-10-31',
  days: '2.0',
  mode: 'Full Day',
  reason: 'trip',
  status: 'Pending',
  requested_on: '2026-10-20',
  leave_types: { name: 'Annual' },
  employees: { full_name: 'Vikram Deshmukh', emp_no: 'EM-20810' },
  evidence: { window: { from: '2026-10-30', to: '2026-10-31' }, nearby_approved: [], holidays: [] },
  ...overrides,
})

describe('pages/AdminStaleRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchStaleRequests).mockResolvedValue({ rows: [stale()], error: null })
  })

  afterEach(() => vi.restoreAllMocks())

  function setup(setToast = vi.fn()) {
    render(
      <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
        <AdminStaleRequests />
      </AuthContext.Provider>
    )
    return setToast
  }

  it('lists stale rows with employee, dates and the evidence disclosure', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Vikram Deshmukh')).toBeInTheDocument())
    expect(screen.getByText('Work context')).toBeInTheDocument()
    expect(fetchStaleRequests).toHaveBeenCalledWith(todayISO())
  })

  it('approves a stale request through the shared decision endpoint', async () => {
    const user = userEvent.setup()
    vi.mocked(decide).mockResolvedValue({ error: null })
    setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('LV-00003', 'Approved', 'admin-review'))
    expect(fetchStaleRequests).toHaveBeenCalledTimes(2) // reload after decision
  })

  it('toasts a decision failure and leaves the row in place', async () => {
    const user = userEvent.setup()
    vi.mocked(decide).mockResolvedValue({
      error: { code: 409, context: 'decide request', userMessage: 'Could not save request decision' },
    })
    setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(decide).toHaveBeenCalled())
    expect(fetchStaleRequests).toHaveBeenCalledTimes(1)
  })
})
