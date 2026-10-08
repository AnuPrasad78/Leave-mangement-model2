export function normalizeSupabaseError(error, context = '') {
  if (!error) return null

  const message = error.message || 'Something went wrong. Please try again.'
  const isOverlapError =
    context === 'submit request' &&
    message.includes('leave_requests_no_overlap')

  return {
    code: error.code ?? 'unknown',
    context,
    userMessage: isOverlapError
      ? 'You have applied leave on the same day'
      : message,
  }
}
