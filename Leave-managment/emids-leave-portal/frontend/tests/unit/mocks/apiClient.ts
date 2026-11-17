import { vi } from 'vitest'

/** Mock for services/apiClient — the transport seam behind every service. */
export const apiRequest = vi.fn()

export function resetApiClientMock(): void {
  apiRequest.mockReset()
}
