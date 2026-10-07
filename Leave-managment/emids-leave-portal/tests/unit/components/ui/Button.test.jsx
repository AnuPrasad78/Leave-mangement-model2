import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../../../../src/components/ui'

describe('ui/Button', () => {
  it.each([
    ['primary', 'btn btn--primary'],
    ['ghost', 'btn btn--ghost'],
    ['danger', 'btn btn--danger'],
  ])('renders the %s variant', (variant, expectedClass) => {
    render(<Button variant={variant}>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(expectedClass)
  })

  it('defaults to the primary variant and type button', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('btn btn--primary')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('supports size and extra class modifiers', () => {
    render(<Button variant='ghost' size='sm' className='btn--logout'>Log out</Button>)
    expect(screen.getByRole('button', { name: 'Log out' })).toHaveClass('btn btn--ghost btn--sm btn--logout')
  })

  it('renders the busy state with spinner and pinned busy label', () => {
    render(<Button busy busyLabel='Verifying credentials'>Sign in</Button>)
    const btn = screen.getByRole('button')
    expect(btn.querySelector('.spinner')).not.toBeNull()
    expect(screen.getByText('Verifying credentials')).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('stays clickable when not busy and fires the handler', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Sign in</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('submits forms when type=submit', () => {
    render(<Button type='submit'>Go</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
