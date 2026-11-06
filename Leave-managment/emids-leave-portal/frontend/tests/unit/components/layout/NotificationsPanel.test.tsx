import { vi } from 'vitest'

vi.mock('../../../../src/services/notifications', () => ({
  fetchMyNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
}))

import { render, screen, waitFor } from '@testing-library/react'
import NotificationsPanel from '../../../../src/components/layout/NotificationsPanel'
import { fetchMyNotifications } from '../../../../src/services/notifications'
import { markAllNotificationsRead } from '../../../../src/services/notifications'
import type { NotificationRow } from '../../../../src/types/models'
import type { ServicedError } from '../../../../src/types/models'

const row = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 1,
  kind: 'request_decided',
  title: 'Leave request LV-00001 Approved',
  body: 'Your 2026-11-20 leave request was Approved.',
  target_type: 'leave_request',
  target_id: 'LV-00001',
  read_at: null,
  created_at: '2026-11-01T09:00:00Z',
  ...overrides,
})

describe('components/layout/NotificationsPanel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens as a dialog and lists notifications newest first', async () => {
    vi.mocked(fetchMyNotifications).mockResolvedValue({
      rows: [
        row({ id: 2, title: 'Newer notice' }),
        row({ id: 1, title: 'Older notice' }),
      ],
      error: null,
    })
    render(<NotificationsPanel onDismiss={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Newer notice')).toBeInTheDocument())
    expect(screen.getByText('Older notice')).toBeInTheDocument()
    // Opening the panel acknowledges the loaded batch.
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled())
  })

  it('shows the unread badge for rows without read_at', async () => {
    vi.mocked(fetchMyNotifications).mockResolvedValue({
      rows: [row({ read_at: null }), row({ id: 3, read_at: '2026-11-02T00:00:00Z', title: 'Read one' })],
      error: null,
    })
    render(<NotificationsPanel onDismiss={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/1 new/)).toBeInTheDocument())
    expect(screen.getByText('Read one')).toBeInTheDocument()
  })

  it('shows the empty state when nothing has been sent', async () => {
    vi.mocked(fetchMyNotifications).mockResolvedValue({ rows: [], error: null })
    render(<NotificationsPanel onDismiss={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Nothing here yet.')).toBeInTheDocument())
  })

  it('surfaces the service error message on failure', async () => {
    const error = { userMessage: 'Cannot reach notifications' } as unknown as ServicedError
    vi.mocked(fetchMyNotifications).mockResolvedValue({ rows: [], error })
    render(<NotificationsPanel onDismiss={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Cannot reach notifications')).toBeInTheDocument())
  })
})
