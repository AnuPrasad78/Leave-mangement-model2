import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPanel from '../../../../src/components/layout/ChatPanel'

function renderPanel({ onDismiss = () => {}, profile } = {}) {
  return render(<ChatPanel profile={profile} onDismiss={onDismiss} />)
}

describe('layout/ChatPanel', () => {
  it('renders the demo dialog with the pinned markup and options', () => {
    renderPanel({ profile: { full_name: 'Anup Prasad' } })
    const panel = document.querySelector('.chatpanel')
    expect(panel).toHaveAttribute('role', 'dialog')
    expect(panel).toHaveAttribute('aria-label', 'AI assistant')
    expect(screen.getByRole('button', { name: 'How do I apply for leave?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Why does my balance differ?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel a submitted request' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Who approves contingency leave?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close assistant' })).toBeInTheDocument()
    expect(screen.getByText('DEMO · RESPONSES DISABLED')).toBeInTheDocument()
  })

  it('greets the signed-in employee by first name, guests by "there"', () => {
    const { unmount } = renderPanel({ profile: { full_name: 'Anup Prasad' } })
    const msg = document.querySelector('.chatpanel__msg')
    expect(msg.textContent).toContain('Anup')
    expect(msg.textContent).toContain('tell me what you need')
    unmount()
    renderPanel({ profile: null })
    expect(document.querySelector('.chatpanel__msg').textContent).toContain('Hi there')
  })

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn()
    renderPanel({ onDismiss })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss on outside mousedown (Escape-only contract)', () => {
    const onDismiss = vi.fn()
    renderPanel({ onDismiss })
    fireEvent.mouseDown(document.body)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses via the close button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    renderPanel({ onDismiss })
    await user.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
