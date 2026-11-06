import { render, screen } from '@testing-library/react'
import { StatusPill } from '../../../../src/components/ui'

describe('ui/StatusPill', () => {
  it.each([
    ['Approved', 'pill pill--approved'],
    ['Pending', 'pill pill--pending'],
    ['Rejected', 'pill pill--rejected'],
    ['Cancelled', 'pill pill--cancelled'],
  ])('renders %s with the pinned class', (status, expectedClass) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(status)).toHaveClass(expectedClass)
  })

  it('falls back to the cancelled styling for unknown statuses', () => {
    render(<StatusPill status='Unknown' />)
    expect(screen.getByText('Unknown')).toHaveClass('pill pill--cancelled')
  })
})
