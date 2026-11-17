import { render, screen } from '@testing-library/react'
import RootPage from '../../../app/page'
import CatchAllPage from '../../../app/[...slug]/page'
import NotFound from '../../../app/not-found'

const replace = vi.fn()
const push = vi.fn()

beforeEach(() => {
  replace.mockClear()
  push.mockClear()
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
}))

/* React Router parity for the redirect family: `/` -> /login, `*` -> /
 * (both <Navigate replace>), each via history-replacing client navigation. */
describe('app redirects', () => {
  it('the root page replaces the browser history to /login', () => {
    vi.useFakeTimers()
    try {
      render(<RootPage />)
    } finally {
      vi.useRealTimers()
    }
    expect(screen.queryByText(/Leave Management/)).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/login')
    expect(push).not.toHaveBeenCalled()
  })

  it('the catch-all replaces unknown top-level paths to /', () => {
    render(<CatchAllPage />)
    expect(replace).toHaveBeenCalledWith('/')
    expect(push).not.toHaveBeenCalled()
  })

  it('the catch-all replaces unknown nested paths to /', () => {
    render(<CatchAllPage />)
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('the not-found page renders static copy and does not redirect', () => {
    render(<NotFound />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
