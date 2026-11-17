import { useEffect, useState } from 'react'

/** Keeps the live value for inputs while gating consumers to a settled copy. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return settled
}
