import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmModal } from '../../../../src/components/ui'

function Harness({ danger }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Trigger</button>
      {open && (
        <ConfirmModal
          title='Cancel request'
          text='This cannot be undone.'
          confirmLabel='Cancel Request'
          danger={danger}
          onConfirm={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

describe('ui/ConfirmModal', () => {
  it('renders title, text and action buttons with pinned classes', async () => {
    const user = userEvent.setup()
    render(<Harness danger />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(document.querySelector('.modal')).not.toBeNull()
    expect(screen.getByText('Cancel request')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Request' })).toHaveClass('btn btn--danger')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('btn btn--ghost')
  })

  it('uses primary styling without danger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByRole('button', { name: 'Cancel Request' })).toHaveClass('btn btn--primary')
  })

  it('exposes a modal dialog to assistive tech', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes via backdrop mousedown', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    await user.click(document.querySelector('.modal-backdrop'))
    expect(document.querySelector('.modal')).toBeNull()
  })

  it('closes on Escape and returns focus to the trigger afterwards', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement)
    await user.keyboard('{Escape}')
    expect(document.querySelector('.modal')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Trigger' }))
  })

  it('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    const inside = screen.getAllByRole('button')
    for (let i = 0; i < 8; i++) {
      await user.keyboard('{Tab}')
      expect(inside).toContain(document.activeElement)
    }
  })
})
