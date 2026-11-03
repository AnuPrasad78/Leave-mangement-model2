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
