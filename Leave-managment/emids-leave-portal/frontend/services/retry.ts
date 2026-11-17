// Bounded retry for SAFE read-only transport failures only. Mutations,
// validation, authorization, business-rule rejections, aborted requests, and
// credential failures are never retried — callers keep the final result.
const TRANSIENT_CODES = new Set<number | string>([
  429, 500, 502, 503, 504,
  '429', '500', '502', '503', '504',
])

const TRANSIENT_MESSAGE =
  /failed to fetch|fetch failed|networkerror|network error|load failed|socket|timed? ?out|econn|internal server error|service unavailable|bad gateway|gateway timeout|too many requests|overloaded|temporarily unavailable|rate limit/i

const ABORTED = /abort/i

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
}

export const DEFAULT_RETRIES = 2
export const DEFAULT_BASE_DELAY_MS = 400
const MAX_DELAY_MS = 3000
const MAX_RETRY_AFTER_MS = 5000

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isTransientQueryFailure(value: unknown): boolean {
  if (!isObject(value)) return false
  const { name, message, userMessage, code, status } = value as {
    name?: unknown
    message?: unknown
    userMessage?: unknown
    code?: unknown
    status?: unknown
  }
  if (typeof name === 'string' && ABORTED.test(name)) return false
  if (typeof message === 'string' && ABORTED.test(message)) return false
  if (typeof code === 'number' || typeof code === 'string') {
    if (TRANSIENT_CODES.has(code)) return true
  }
  if (typeof status === 'number' && TRANSIENT_CODES.has(status)) return true
  if (typeof message === 'string' && TRANSIENT_MESSAGE.test(message)) return true
  if (typeof userMessage === 'string' && TRANSIENT_MESSAGE.test(userMessage)) return true
  return false
}

function parseRetryAfterMs(error: unknown): number | null {
  if (!isObject(error)) return null
  const directDelay = error.retryAfterMs
  if (typeof directDelay === 'number' && Number.isFinite(directDelay) && directDelay >= 0) return Math.min(directDelay, MAX_RETRY_AFTER_MS)
  if (!isObject(error.headers)) return null
  const headers = error.headers as Record<string, unknown>
  const raw = headers['retry-after'] ?? headers['Retry-After']
  const seconds = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  if (typeof raw === 'string') {
    const dateDelay = Date.parse(raw) - Date.now()
    if (Number.isFinite(dateDelay) && dateDelay >= 0) return Math.min(dateDelay, MAX_RETRY_AFTER_MS)
  }
  return null
}

function delayForAttempt(attempt: number, baseDelayMs: number, error: unknown): number {
  const retryAfterMs = parseRetryAfterMs(error)
  if (retryAfterMs !== null) return retryAfterMs
  const raw = Math.min(MAX_DELAY_MS, baseDelayMs * 2 ** attempt)
  const jitter = raw * (Math.random() * 0.6 - 0.3)
  return Math.min(MAX_DELAY_MS, Math.max(0, raw + jitter))
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// PostgREST builders are thenables, not Promises, so callers hand over any
// PromiseLike chainable.
export async function withQueryRetry<T>(
  op: () => PromiseLike<T>,
  { retries = DEFAULT_RETRIES, baseDelayMs = DEFAULT_BASE_DELAY_MS }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await op()
      const error = isObject(result) ? (result as { error?: unknown }).error : undefined
      if (attempt >= retries || !isTransientQueryFailure(error)) return result
      await sleep(delayForAttempt(attempt, baseDelayMs, error))
    } catch (err) {
      if (attempt >= retries || !isTransientQueryFailure(err)) throw err
      await sleep(delayForAttempt(attempt, baseDelayMs, err))
    }
  }
}
