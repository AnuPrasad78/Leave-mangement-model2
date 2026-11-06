import { vi } from 'vitest'

let token: string | null = null

/** Mock for src/services/apiClient — the transport seam behind every service. */
export const apiRequest = vi.fn()

export function getAccessToken(): string | null {
  return token
}

export function setAccessToken(value: string): void {
  token = value
}

export function clearAccessToken(): void {
  token = null
}

export function resetApiClientMock(): void {
  token = null
  apiRequest.mockReset()
}
