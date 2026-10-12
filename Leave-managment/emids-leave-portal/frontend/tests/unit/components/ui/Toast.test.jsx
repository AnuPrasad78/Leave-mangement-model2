import { render, screen } from '@testing-library/react'
import { AuthContext } from '../../../../src/store/AuthContext'
import { Toast } from '../../../../src/components/ui'

function renderToast(toast) {
  return render(
    <AuthContext.Provider value={{ toast }}>
      <Toast />
    </AuthContext.Provider>
  )
}

describe('ui/Toast', () => {
  it('renders nothing when no toast is set', () => {
    const { container } = renderToast(null)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message with the pinned classes', () => {
    renderToast({ msg: 'Request approved', kind: 'ok', id: 1 })
    expect(screen.getByText('Request approved').closest('.toast')).not.toHaveClass('toast--red')
  })

  it('marks error toasts with toast--red', () => {
    renderToast({ msg: 'Something failed', kind: 'red', id: 1 })
    expect(screen.getByText('Something failed').closest('.toast')).toHaveClass('toast--red')
  })

  it('announces itself to screen readers', () => {
    renderToast({ msg: 'Saved', kind: 'ok', id: 1 })
    const plate = document.querySelector('.toast')
    expect(plate).toHaveAttribute('role', 'status')
    expect(plate).toHaveAttribute('aria-live', 'polite')
  })
})
