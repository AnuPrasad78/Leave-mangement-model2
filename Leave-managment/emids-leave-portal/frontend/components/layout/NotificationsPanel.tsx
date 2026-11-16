import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'
import { IconButton } from '../ui'
import { IconX } from '../Icons'
import { fmtDate } from '../../utils/dates'
import { fetchMyNotifications, markAllNotificationsRead } from '../../services/notifications'
import type { NotificationRow } from '../../types/models'

export interface NotificationsPanelProps {
  onDismiss: () => void
}

/** Recipient view of DB-backed notifications: decision notices and admin
 * nudges, newest first. Fetches on open; the backend owns the truth. */
export default function NotificationsPanel({ onDismiss }: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Clicking the bell while open must close, not reopen: ignore the mousedown
  // on its toggle button so the button's own click sees an open panel and
  // flips it closed.
  useDismiss(ref, { onClose: onDismiss, ignoreSelector: '[data-notif-toggle]' })

  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetchMyNotifications().then(({ rows: fresh, error: lookupError }) => {
      if (!mounted) return
      setError(lookupError ? lookupError.userMessage : null)
      setRows(fresh)
      // Failed sends stay unread; opening the panel acknowledges whatever
      // loaded fine. Fire-and-forget: the badge refresh happens on close.
      // Promise.resolve guards against the (test-mock) case of the function
      // not returning a promise.
      if (!lookupError) void Promise.resolve(markAllNotificationsRead()).catch(() => {})
    })
    return () => {
      mounted = false
    }
  }, [])

  // GET /notifications already returns newest first
  const ordered = rows ?? []
  const unread = ordered.filter((row) => !row.read_at)

  return (
    <div ref={ref} className="notif-pop" role="dialog" aria-label="Notifications">
      <div className="notif-pop__head">
        <span className="eyebrow">Notifications {unread.length > 0 ? `· ${unread.length} new` : ''}</span>
        <IconButton label="Close notifications" onClick={onDismiss}>
          <IconX size={17} />
        </IconButton>
      </div>
      <div className="notif-pop__list">
        {rows === null && !error && <div className="notif-pop__empty">Loading…</div>}
        {error && <div className="notif-pop__empty">{error}</div>}
        {rows !== null && !error && ordered.length === 0 && (
          <div className="notif-pop__empty">
            <b>Nothing here yet.</b>
            <span>Decisions on your requests and admin nudges will appear in this list.</span>
          </div>
        )}
        {rows !== null &&
          !error &&
          ordered.map((row) => (
            <div key={row.id} className={`notif-item${row.read_at ? '' : ' notif-item--unread'}`}>
              <div className="notif-item__body">
                <span className="notif-item__title">{row.title}</span>
                <span className="notif-item__meta">{row.body}</span>
                <span className="notif-item__meta">{fmtDate(row.created_at)}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
