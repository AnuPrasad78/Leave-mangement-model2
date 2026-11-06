import { Button } from '../atoms/Button'

export interface PagerProps {
  page: number
  pageCount: number
  /** Requests the neighbouring page; the parent owns the state. */
  onChange: (page: number) => void
}

/** MOLECULE — the Prev/Next pagination bar shared by the list boards.
 * Renders nothing while the list fits on one page. */
export function Pager({ page, pageCount, onChange }: PagerProps) {
  if (pageCount <= 1) return null
  return (
    <div className="pager">
      <span className="pager__info">
        Page {page} of {pageCount}
      </span>
      <span className="pager__steps">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← Prev
        </Button>
        <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          Next →
        </Button>
      </span>
    </div>
  )
}
