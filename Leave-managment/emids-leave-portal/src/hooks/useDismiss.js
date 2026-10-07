import { useEffect } from 'react'

/** Dismiss-on-Escape / outside-mousedown for popovers, drawers and dialogs. */
export function useDismiss(ref, { onClose, enabled = true, escape = true, outside = true } = {}) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e) => {
      if (escape && e.key === 'Escape') onClose()
    }
    const onMouseDown = (e) => {
      if (outside && !ref.current?.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [enabled, escape, outside, onClose, ref])
}
