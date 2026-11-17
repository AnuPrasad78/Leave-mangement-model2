import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { NotificationRow, ServicedError } from '../types/models'

export async function fetchMyNotifications(): Promise<{ rows: NotificationRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'notification lookup',
    async () => {
      const rows = await apiRequest<NotificationRow[]>('/notifications')
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

/** Marks every unread notification for the current user as read. The panel
 * calls this after a successful lookup so the bell badge clears. */
export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/notifications/read', { method: 'PATCH', body: JSON.stringify({}) })
}
