import { vi } from 'vitest'

let token = null

export const apiRequest = vi.fn()

export function getAccessToken() {
  return token
}

export function setAccessToken(value) {
  token = value
}

export function clearAccessToken() {
  token = null
}

export function resetApiClientMock() {
  token = null
  apiRequest.mockReset()
}
