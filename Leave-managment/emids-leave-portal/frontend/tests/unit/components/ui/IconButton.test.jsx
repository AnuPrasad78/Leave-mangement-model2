import { render, screen } from '@testing-library/react'
import { IconButton } from '../../../../src/components/ui'

describe('ui/IconButton', () => {
  it('renders the icon-btn class with matching aria-label', () => {
    render(<IconButton label='Menu'><svg /></IconButton>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('icon-btn')
    expect(btn).toHaveAttribute('aria-label', 'Menu')
    expect(btn.firstElementChild.tagName).toBe('svg')
  })

  it('adds the is-on state and keeps label/title synced', () => {
    render(<IconButton label='Show my profile' isOn>icon</IconButton>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('is-on')
    expect(btn).toHaveAttribute('title', 'Show my profile')
  })

  it('forwards extra props (aria-haspopup, aria-expanded, className)', () => {
    render(
      <IconButton label='Notifications' title='Notifications' aria-haspopup='dialog' aria-expanded={true} className='header__profile'>
        icon
      </IconButton>
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(btn).toHaveClass('icon-btn header__profile')
  })
})
