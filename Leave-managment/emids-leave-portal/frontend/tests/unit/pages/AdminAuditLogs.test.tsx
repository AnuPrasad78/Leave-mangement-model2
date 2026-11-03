import { vi } from 'vitest'

vi.mock('../../../src/services/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/admin')>()
  return { ...actual, fetchAuditLogs: vi.fn() }
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import AdminAuditLogs from '../../../src/pages/AdminAuditLogs'
import { fetchAuditLogs } from '../../../src/services/admin'
import type { AuditLogRow } from '../../../src/types/models'

const row = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: 1,
  actor_user_id: 'u1',
  actor_employee_id: 'e1',
  action: 'employee_created',
  target_type: 'employee',
  target_id: 'e9',
  detail_json: { email: 'hired@emids.com' },
  request_ip: '10.0.0.1',
  created_at: '2026-11-01T08:00:00Z',
  ...overrides,
})

describe('pages/AdminAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAuditLogs).mockResolvedValue({ page: { items: [row()], total: 1 }, error: null })
  })

  afterEach(() => vi.restoreAllMocks())

  function setup(setToast = vi.fn()) {
    render(
      <AuthContext.Provider value={{ setToast } as unknown as AuthContextValue}>
        <AdminAuditLogs />
      </AuthContext.Provider>
    )
    return setToast
  }

  it('lists the trail with the total count', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/Total 1/)).toBeInTheDocument())
    expect(screen.getByText('employee e9')).toBeInTheDocument() // target column
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
  })

  it('re-runs with the chosen action filter', async () => {
    const user = userEvent.setup()
    setup()
    await user.selectOptions(screen.getByLabelText('Action'), 'balance_updated')
    await user.click(screen.getByRole('button', { name: 'Re-run' }))
    await waitFor(() =>
      expect(fetchAuditLogs).toHaveBeenLastCalledWith({
        action: 'balance_updated',
        date_from: undefined,
        date_to: undefined,
      })
    )
  })
})
