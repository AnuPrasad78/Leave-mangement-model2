import { vi } from 'vitest'

/** Mock for src/services/apiClient — the transport seam behind every service. */
export const AUTH_EVENT = 'leave-portal-auth-change'
export const apiRequest = vi.fn()

export function resetApiClientMock(): void {
  apiRequest.mockReset()
}
