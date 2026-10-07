import { useEffect, useRef } from 'react'
import { IconX } from '../Icons'
import { useDismiss } from '../../hooks/useDismiss'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onClose }) {
  const ref = useRef(null)
  useDismiss(ref, { onClose })

  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector(FOCUSABLE)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = ref.current?.querySelectorAll(FOCUSABLE)
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!ref.current.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  return (
    <div className='modal-backdrop'>
      <div className='modal' role='dialog' aria-modal='true' aria-label={title} ref={ref}>
        <div className='modal__bar' />
        <div className='modal__body'>
          <div className='modal__title'>{title}</div>
          <p className='modal__text'>{text}</p>
          <div className='modal__actions'>
            <button className='btn btn--ghost' onClick={onClose}>
              <IconX size={14} /> Close
            </button>
            <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
