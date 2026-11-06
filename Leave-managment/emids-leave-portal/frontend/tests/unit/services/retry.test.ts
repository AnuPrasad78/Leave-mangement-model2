import { vi, describe, it, expect } from 'vitest'
import { withQueryRetry, isTransientQueryFailure } from '../../../src/services/retry'

describe('services/retry', () => {
  describe('withQueryRetry', () => {
    it('retries a transient in-band error and returns the eventual result', async () => {
      vi.useFakeTimers()
      try {
        let calls = 0
        const op = () => {
          calls++
          return calls === 1
            ? Promise.resolve({ data: null, error: { message: 'internal server error', code: '500' } })
            : Promise.resolve({ data: { ok: 1 }, error: null })
        }
        const promise = withQueryRetry(op as () => PromiseLike<{ data: unknown; error: { message?: string; code?: string | number; headers?: Record<string, string> } | null }>)
        await vi.advanceTimersByTimeAsync(4000)
        const result = await promise
        expect(calls).toBe(2)
        expect(result.data).toEqual({ ok: 1 })
      } finally {
        vi.useRealTimers()
      }
    })

    it('never retries non-transient results (validation/4xx)', async () => {
      const op = vi.fn(() =>
        Promise.resolve({ data: null, error: { message: 'row not found', code: 'PGRST116' } })
      )
      const result = await withQueryRetry(op)
      expect(op).toHaveBeenCalledTimes(1)
      expect(result.error.code).toBe('PGRST116')
    })

    it('retries a thrown transient transport failure and then succeeds', async () => {
      vi.useFakeTimers()
      try {
        let calls = 0
        const op = () => {
          calls++
          return calls === 1
            ? Promise.reject(Object.assign(new Error('Failed to fetch')))
            : Promise.resolve({ data: 'ok', error: null })
        }
        const promise = withQueryRetry(op as () => PromiseLike<{ data: unknown; error: { message?: string; code?: string | number; headers?: Record<string, string> } | null }>)
        await vi.advanceTimersByTimeAsync(8000)
        expect(await promise).toEqual({ data: 'ok', error: null })
        expect(calls).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('propagates an aborted request without retrying', async () => {
      const op = vi.fn(() =>
        Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
      )
      await expect(withQueryRetry(op)).rejects.toThrow('aborted')
      expect(op).toHaveBeenCalledTimes(1)
    })

    it('stays bounded when every attempt fails transiently, returning the last result', async () => {
      vi.useFakeTimers()
      try {
        let calls = 0
        const op = () => {
          calls++
          return Promise.resolve({ data: null, error: { message: 'service unavailable', code: 503 } })
        }
        const promise = withQueryRetry(op as () => PromiseLike<{ data: unknown; error: { message?: string; code?: string | number; headers?: Record<string, string> } | null }>)
        await vi.advanceTimersByTimeAsync(30000)
        const result = await promise
        expect(calls).toBe(3)
        expect((result!.error as { code: number }).code).toBe(503)
      } finally {
        vi.useRealTimers()
      }
    })

    it('honors Retry-After instead of the backoff curve', async () => {
      vi.useFakeTimers()
      try {
        let calls = 0
        const op = vi.fn(() => {
          calls++
          return calls === 1
            ? Promise.resolve({ data: null, error: { message: 'too many requests', code: '429', headers: { 'Retry-After': '2' } } })
            : Promise.resolve({ data: 'ok', error: null })
        })
        const promise = withQueryRetry(op as () => PromiseLike<{ data: unknown; error: { message?: string; code?: string | number; headers?: Record<string, string> } | null }>)
        // Retry-After = 2s: the retry must not fire before it elapses
        await vi.advanceTimersByTimeAsync(1999)
        expect(calls).toBe(1)
        await vi.advanceTimersByTimeAsync(10)
        expect(await promise).toEqual({ data: 'ok', error: null })
        expect(calls).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('caps a huge Retry-After instead of waiting it out', async () => {
      vi.useFakeTimers()
      try {
        let calls = 0
        const op = () => {
          calls++
          return calls === 1
            ? Promise.resolve({ data: null, error: { message: 'too many requests', code: '429', headers: { 'retry-after': '3600' } } })
            : Promise.resolve({ data: 'ok', error: null })
        }
        const promise = withQueryRetry(op as () => PromiseLike<{ data: unknown; error: { message?: string; code?: string | number; headers?: Record<string, string> } | null }>)
        await vi.advanceTimersByTimeAsync(5001)
        expect(await promise).toEqual({ data: 'ok', error: null })
        expect(calls).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('isTransientQueryFailure', () => {
    const truthy = [
      { message: 'TypeError: Failed to fetch' },
      { message: 'fetch failed', code: '' },
      { message: 'NetworkError when attempting to fetch resource' },
      { message: 'something', code: '500' },
      { message: 'something', code: 502 },
      { message: 'something', status: 503 },
      { message: 'too many requests' },
      { message: 'rate limit exceeded' },
      { message: 'gateway timeout', code: null },
    ]
    it.each(truthy)('treats %j as transient', (value) => {
      expect(isTransientQueryFailure(value)).toBe(true)
    })

    const falsy = [
      null,
      undefined,
      'plain string failure',
      { message: 'row not found', code: 'PGRST116' },
      { message: 'not enough balance', code: '23514' },
      { message: 'You can choose only 3 optional holidays per year', code: 'P0001' },
      { message: 'permission denied', code: '42501' },
      { message: '[mock] no queued response for select on "leave_requests"', code: 'MOCK_UNQUEUED' },
      { message: 'Invalid login credentials', code: 400 },
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
      { message: 'The request was aborted because the signal is already aborted' },
    ]
    it.each(falsy)('treats %j as non-transient', (value) => {
      expect(isTransientQueryFailure(value)).toBe(false)
    })
  })
})
