import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../../../src/utils/ErrorBoundary'

function Bomb({ boom }) {
  if (boom) throw new Error('kaboom')
  return <button>safe</button>
}

describe('utils/ErrorBoundary', () => {
  let consoleErr
  beforeEach(() => {
    consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => consoleErr.mockRestore())

  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><Bomb boom={false} /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: 'safe' })).toBeInTheDocument()
  })

  it('shows the fallback panel instead of exposing a blank page', () => {
    render(<ErrorBoundary><Bomb boom /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload dashboard' })).toBeInTheDocument()
  })
})
