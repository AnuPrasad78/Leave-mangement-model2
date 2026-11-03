export const PAGE_SIZE = 10

export interface PageView<T> {
  rows: T[]
  /** Bounds-clamped page actually shown (0 when the list is empty). */
  page: number
  pageCount: number
  total: number
}

/**
 * One slice of an ordered list — the shared pagination math behind the
 * list boards (roster, balances, audit queue). Out-of-range pages clamp
 * into the surviving range so a shrunken list never strands the reader
 * on a blank page.
 */
export function paginate<T>(rows: readonly T[], page: number, size: number = PAGE_SIZE): PageView<T> {
  const pageCount = Math.ceil(rows.length / size)
  if (pageCount === 0) return { rows: [], page: 0, pageCount: 0, total: 0 }
  const sat = Math.min(Math.max(1, page), pageCount)
  const start = (sat - 1) * size
  return {
    rows: rows.slice(start, start + size),
    page: sat,
    pageCount,
    total: rows.length,
  }
}
