import { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDismiss } from '../../../src/hooks/useDismiss'

function Harness({ enabled = true, escape = true, outside = true }) {
  const [open, setOpen] = useState(true)
  const ref = useRef(null)
  useDismiss(ref, { onClose: () => setOpen(false), enabled, escape, outside })
  if (!open) return <button onClick={() => setOpen(true)}>Reopen</button>
  return (
    <div>
      <div data-testid='outside'>outside</div>
      <div ref={ref} data-testid='pop'>inside</div>
    </div>
  )
}

describe('hooks/useDismiss', () => {
  it('closes on Escape when enabled', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('pop')).toBeNull()
  })

  it('closes on outside mousedown, not on inside clicks', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    fireEvent.mouseDown(screen.getByTestId('pop'))
    expect(screen.getByTestId('pop')).not.toBeNull()
    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByTestId('pop')).toBeNull()
  })

  it('does nothing when disabled', () => {
    render(<Harness enabled={false} />)
    fireEvent.mouseDown(document.body)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('pop')).not.toBeNull()
  })

  it('can switch individual behaviors off', async () => {
    const user = userEvent.setup()
    render(<Harness escape={false} />)
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('pop')).not.toBeNull()
    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByTestId('pop')).toBeNull()
  })

  it('re-enables when reopened', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('outside'))
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByTestId('pop')).toBeNull()
  })
})
