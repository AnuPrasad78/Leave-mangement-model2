import { render, screen } from '@testing-library/react'
import { Donut } from '../../../../src/components/ui'

describe('ui/Donut', () => {
  it('renders the used-percentage and label', () => {
    render(<Donut used={5} total={20} label='Annual leave' />)
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('Annual leave')).toBeInTheDocument()
    expect(document.querySelector('svg.donut')).not.toBeNull()
  })

  it('renders 0% when total is 0', () => {
    render(<Donut used={3} total={0} label='x' />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
