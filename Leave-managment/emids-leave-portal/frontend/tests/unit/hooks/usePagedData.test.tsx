import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePagedData } from '../../../src/hooks/usePagedData'
import type { PagedResult } from '../../../src/hooks/usePagedData'
import type { ServicedError } from '../../../src/types/models'

const env = (rows: string[], page: number, total: number): PagedResult<string> => ({
  page: { rows, page, page_size: 2, total, page_count: Math.ceil(total / 2) },
  error: null,
})

const err: ServicedError = { code: 500, context: 'paged read', userMessage: 'Server hiccup' }

type ProbeProps = {
  fetcher: (page: number) => Promise<PagedResult<string>>
  resetKeys?: unknown[]
  reloadNonce?: number
}

function Probe({ fetcher, resetKeys, reloadNonce }: ProbeProps) {
  const paged = usePagedData<string>({ fetcher, resetKeys, reloadNonce })
  return (
    <div>
      <p data-testid="rows">{paged.rows.join('|')}</p>
      <p data-testid="total">{paged.total}</p>
      <p data-testid="page">{paged.page}</p>
      <button onClick={() => paged.setPage(2)}>Next</button>
      <button onClick={() => paged.setPage(1)}>Back</button>
    </div>
  )
}

let fetcher: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetcher = vi.fn()
})

describe('hooks/usePagedData', () => {
  it('fetches page 1 on mount and applies the envelope', async () => {
    fetcher.mockResolvedValue(env(['a', 'b'], 1, 4))
    render(<Probe fetcher={fetcher} resetKeys={[]} />)
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('a|b'))
    expect(screen.getByTestId('total').textContent).toBe('4')
    expect(fetcher).toHaveBeenCalledWith(1)
  })

  it('requests the page the pager asks for', async () => {
    const user = userEvent.setup()
    fetcher.mockResolvedValueOnce(env(['a', 'b'], 1, 4))
    fetcher.mockResolvedValueOnce(env(['c', 'd'], 2, 4))
    render(<Probe fetcher={fetcher} resetKeys={[]} />)
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('1'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('c|d'))
    expect(screen.getByTestId('page').textContent).toBe('2')
    expect(fetcher).toHaveBeenLastCalledWith(2)
  })

  it('does not refetch the same page twice', async () => {
    const user = userEvent.setup()
    fetcher.mockResolvedValue(env(['a'], 1, 1))
    render(<Probe fetcher={fetcher} resetKeys={[]} />)
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('1'))
    await user.click(screen.getByRole('button', { name: 'Back' })) // already on page 1
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('resets to page 1 when a reset key changes', async () => {
    fetcher.mockResolvedValueOnce(env(['a', 'b'], 1, 4))
    fetcher.mockResolvedValueOnce(env(['a'], 1, 1))
    const { rerender } = render(<Probe fetcher={fetcher} resetKeys={['filter']} />)
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('a|b'))
    rerender(<Probe fetcher={fetcher} resetKeys={['changed']} />)
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('a'))
    // both runs re-entered at page 1
    expect(fetcher).toHaveBeenNthCalledWith(1, 1)
    expect(fetcher).toHaveBeenNthCalledWith(2, 1)
  })

  it('ignores a stale response that lost the race', async () => {
    let release: (value: PagedResult<string>) => void = () => {}
    const slow = new Promise<PagedResult<string>>((resolve) => {
      release = resolve
    })
    fetcher.mockImplementationOnce(() => slow) // the page-1 fetch hangs
    fetcher.mockResolvedValueOnce(env(['fresh'], 1, 1)) // the forced reload answers first
    const { rerender } = render(<Probe fetcher={fetcher} resetKeys={[]} />)
    expect(screen.getByTestId('rows').textContent).toBe('')
    rerender(<Probe fetcher={fetcher} resetKeys={[]} reloadNonce={1} />)
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('fresh'))
    release(env(['stale'], 1, 1)) // the hung response lands late — it must be dropped
    expect(screen.getByTestId('rows').textContent).toBe('fresh')
  })

  it('renders an empty board when the read errors', async () => {
    fetcher.mockResolvedValueOnce({ page: { rows: [], page: 1, page_size: 2, total: 0, page_count: 0 }, error: err })
    render(<Probe fetcher={fetcher} resetKeys={[]} />)
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toBe(''))
    expect(screen.getByTestId('total').textContent).toBe('0')
  })
})
