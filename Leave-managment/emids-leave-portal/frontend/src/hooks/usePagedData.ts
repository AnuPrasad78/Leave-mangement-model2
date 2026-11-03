import { useCallback, useEffect, useRef, useState } from 'react'
import type { Paginated, ServicedError } from '../types/models'

export interface PagedResult<Row> {
  page: Paginated<Row>
  error: ServicedError | null
}

export interface UsePagedDataOptions<Row> {
  /** Fetches one page; keep it stable per run (services close over the filters). */
  fetcher: (page: number) => Promise<PagedResult<Row>>
  /** Every change here resets pagination to page 1 and refetches (fixed length). */
  resetKeys?: unknown[]
  /** Bump to refetch the current page (post-mutation reloads). */
  reloadNonce?: number
}

/**
 * Server-page engine shared by the list boards: page state, a sequencing
 * guard (only the newest request may land) and reset-to-page-1 semantics
 * for filter changes.
 */
export function usePagedData<Row>({ fetcher, resetKeys = [], reloadNonce = 0 }: UsePagedDataOptions<Row>) {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const seq = useRef(0)
  const run = useCallback(
    async (targetPage: number) => {
      const ticket = ++seq.current
      setLoading(true)
      const { page: paged, error } = await fetcher(targetPage)
      if (seq.current !== ticket) return // a newer request already owns the board
      if (error) {
        setRows(paged.rows)
        setTotal(paged.total)
        setPageCount(paged.page_count)
        setLoading(false)
        return
      }
      setRows(paged.rows)
      setTotal(paged.total)
      setPageCount(paged.page_count)
      setPage(paged.page)
      setLoading(false)
    },
    [fetcher]
  )

  useEffect(() => {
    void run(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...resetKeys, reloadNonce])

  return {
    rows,
    total,
    pageCount,
    page,
    loading,
    setPage: (next: number) => {
      if (next !== page) void run(next)
    },
  }
}
