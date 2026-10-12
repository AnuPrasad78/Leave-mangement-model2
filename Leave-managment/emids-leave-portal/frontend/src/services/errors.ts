import type { ServicedError, SupabaseErrorLike } from '../types/models'
import { isTransientQueryFailure } from './retry'
import { withQueryRetry } from './retry'

export function normalizeSupabaseError(error: SupabaseErrorLike | null | undefined, context = ''): ServicedError | null {
  if (!error) return null

  const message = error.message || 'Something went wrong. Please try again.'
  const isOverlapError =
    context === 'submit request' &&
    message.includes('leave_requests_no_overlap')
  const rawRetryAfter = error.headers?.['retry-after'] ?? error.headers?.['Retry-After']
  const retryAfterSeconds = typeof rawRetryAfter === 'string' ? Number(rawRetryAfter) : typeof rawRetryAfter === 'number' ? rawRetryAfter : NaN
  const retryAfterDateMs = typeof rawRetryAfter === 'string' && !Number.isFinite(retryAfterSeconds)
    ? Date.parse(rawRetryAfter) - Date.now()
    : NaN
  const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
    ? retryAfterSeconds * 1000
    : Number.isFinite(retryAfterDateMs) && retryAfterDateMs >= 0 ? retryAfterDateMs : null

  return {
    code: error.code ?? 'unknown',
    context,
    userMessage: isOverlapError
      ? 'You have applied leave on the same day'
      : message,
    ...(error.status !== undefined ? { status: error.status } : {}),
    ...(retryAfterMs !== null ? { retryAfterMs } : {}),
  }
}

export function normalizeThrownError(error: unknown, context = ''): ServicedError {
  const detail = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const message = typeof detail.message === 'string' ? detail.message : undefined
  const code = typeof detail.code === 'string' || typeof detail.code === 'number'
    ? detail.code
    : typeof detail.status === 'number' ? detail.status : 'unknown'
  const headers = detail.headers && typeof detail.headers === 'object' ? detail.headers as Record<string, unknown> : undefined
  return normalizeSupabaseError({ message, code, status: typeof detail.status === 'number' ? detail.status : undefined, headers }, context)!
}

export async function withServiceErrors<T>(
  context: string,
  operation: () => PromiseLike<T>,
  onFailure: (error: ServicedError) => T,
  retryReadOnly = false,
  mutationMayHaveCommitted = false
): Promise<T> {
  try {
    const result = retryReadOnly ? await withQueryRetry(operation) : await operation()
    if (mutationMayHaveCommitted && result && typeof result === 'object' && 'error' in result) {
      const serviceError = (result as { error?: unknown }).error
      if (serviceError && typeof serviceError === 'object' && isTransientQueryFailure(serviceError)) {
        const uncertain = serviceError as ServicedError
        uncertain.outcomeUnknown = true
        uncertain.userMessage = `${uncertain.userMessage} The operation may have completed. Check its status before trying again.`
      }
    }
    return result
  } catch (error) {
    const normalized = normalizeThrownError(error, context)
    if (mutationMayHaveCommitted) {
      normalized.outcomeUnknown = true
      normalized.userMessage = `${normalized.userMessage} The operation may have completed. Check its status before trying again.`
    }
    return onFailure(normalized)
  }
}
