import { useEffect, type RefObject } from 'react'

export interface UseDismissOptions {
  onClose: () => void
  enabled?: boolean
  escape?: boolean
  outside?: boolean
  /** Elements whose mousedown must not count as an outside click — most
   * importantly the toggle button that opens the popover. Without it, the
   * close (mousedown) races the button's own click and the popover reopens. */
  ignoreSelector?: string
}

/** Dismiss-on-Escape / outside-mousedown for popovers, drawers and dialogs. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  { onClose, enabled = true, escape = true, outside = true, ignoreSelector }: UseDismissOptions
): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') onClose()
    }
    const onMouseDown = (e: MouseEvent) => {
      // e.target is an EventTarget; outside clicks resolve against DOM nodes.
      if (!outside || ref.current?.contains(e.target as Node)) return
      const target = e.target
      if (
        ignoreSelector &&
        target instanceof Element &&
        target.closest(ignoreSelector)
      ) {
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [enabled, escape, outside, ignoreSelector, onClose, ref])
}
