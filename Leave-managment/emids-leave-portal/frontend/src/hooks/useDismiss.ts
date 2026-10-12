import { useEffect, type RefObject } from 'react'

export interface UseDismissOptions {
  onClose: () => void
  enabled?: boolean
  escape?: boolean
  outside?: boolean
}

/** Dismiss-on-Escape / outside-mousedown for popovers, drawers and dialogs. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  { onClose, enabled = true, escape = true, outside = true }: UseDismissOptions
): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') onClose()
    }
    const onMouseDown = (e: MouseEvent) => {
      // e.target is an EventTarget; outside clicks resolve against DOM nodes.
      if (outside && !ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [enabled, escape, outside, onClose, ref])
}
