import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip, SegmentedControl } from '../../../../src/components/ui'

describe('ui/Chip', () => {
  it('toggles the is-on class and pressed state', () => {
    render(
      <>
        <Chip isOn>Paid Time Off</Chip>
        <Chip>Work From Home</Chip>
      </>
    )
    const on = screen.getByRole('button', { name: 'Paid Time Off' })
    const off = screen.getByRole('button', { name: 'Work From Home' })
    expect(on).toHaveClass('chip is-on')
    expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(off).toHaveClass('chip')
    expect(off).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Chip onClick={onClick}>Pick</Chip>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('supports alternate base classes (opt-choice toggles)', () => {
    render(<Chip className='opt-choice' isOn>Republic Day</Chip>)
    expect(screen.getByRole('button')).toHaveClass('opt-choice is-on')
  })
})

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
