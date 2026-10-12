import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from '../../../../src/components/ui'

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
