import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from '../../../../src/components/ui'

describe('ui/SegmentedControl', () => {
  const options = ['Full Day', 'First Half', 'Second Half']

  it('renders the pinned seg-group markup with is-on on the active option', () => {
    render(<SegmentedControl value='Full Day' options={options} onChange={() => {}} ariaLabel='Day mode' />)
    const group = document.querySelector('.seg')
    expect(group).toHaveAttribute('role', 'group')
    expect(group).toHaveAttribute('aria-label', 'Day mode')
    expect(screen.getByRole('button', { name: 'Full Day' })).toHaveClass('is-on')
    expect(screen.getByRole('button', { name: 'First Half' })).not.toHaveClass('is-on')
  })

  it('reports the picked option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl value='Full Day' options={options} onChange={onChange} ariaLabel='Day mode' />)
    await user.click(screen.getByRole('button', { name: 'First Half' }))
    expect(onChange).toHaveBeenCalledWith('First Half')
  })
})
