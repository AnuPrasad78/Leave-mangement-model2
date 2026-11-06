import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from '../../../src/hooks/useDebouncedValue'

describe('hooks/useDebouncedValue', () => {
  it('settles to the latest value after the delay', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
        initialProps: { value: 'a' },
      })
      expect(result.current).toBe('a')
      rerender({ value: 'ab' })
      expect(result.current).toBe('a') // not settled yet
      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(result.current).toBe('a')
      act(() => {
        vi.advanceTimersByTime(2)
      })
      expect(result.current).toBe('ab')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops the timer when the value keeps changing', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
        initialProps: { value: 'a' },
      })
      for (const next of ['ab', 'abc', 'abcd']) {
        act(() => {
          vi.advanceTimersByTime(200)
          rerender({ value: next })
        })
      }
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current).toBe('abcd')
    } finally {
      vi.useRealTimers()
    }
  })
})
