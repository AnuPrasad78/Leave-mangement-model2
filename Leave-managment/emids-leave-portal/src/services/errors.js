export function normalizeSupabaseError(error, context = '') {
  if (!error) return null
  return {
    code: error.code ?? 'unknown',
    context,
    userMessage: error.message || 'Something went wrong. Please try again.',
  }
}
