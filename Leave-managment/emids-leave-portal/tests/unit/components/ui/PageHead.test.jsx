import { render, screen } from '@testing-library/react'
import { PageHead } from '../../../../src/components/ui'

describe('ui/PageHead', () => {
  it('renders the pinned page-head markup', () => {
    render(<PageHead eyebrow='New Request' title='Request time off.' />)
    expect(screen.getByText('New Request').closest('header')).toHaveClass('page-head')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Request time off.')
  })

  it('reproduces the separation-request accent (red eyebrow) without inline JSX styles', () => {
    render(<PageHead eyebrow='Separation Request' title='Support your decision' accent />)
    expect(screen.getByText('Separation Request')).toHaveStyle({ color: 'var(--red-deep)' })
  })

  it('renders extra content after the heading', () => {
    render(
      <PageHead eyebrow='Queue' title='Team requests'>
        <button>Approve all</button>
      </PageHead>
    )
    expect(screen.getByRole('button', { name: 'Approve all' })).toBeInTheDocument()
  })
})
