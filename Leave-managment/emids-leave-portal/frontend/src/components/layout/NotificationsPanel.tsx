import { useRef } from 'react'
import { IconButton, StatusPill } from '../ui'
import { useDismiss } from '../../hooks/useDismiss'
import { IconX, IconClipboardCheck, IconFileText } from '../Icons'
import type { IconComponent } from '../Icons'
import type { NotificationItem } from '../../features/notifications/buildNotifications'

const KIND_ICONS: Record<NotificationItem['kind'], IconComponent> = {
  approval: IconClipboardCheck,
  decision: IconFileText,
}

export interface NotificationsPanelProps {
  notifications: NotificationItem[]
  onNavigate: (to: string) => void
  onDismiss: () => void
}

export default function NotificationsPanel({ notifications, onNavigate, onDismiss }: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, { onClose: onDismiss })

  return (
    <>
      <div className="pop-backdrop" aria-hidden="true" />
      <div className="notif-pop" role="dialog" aria-label="Notifications" ref={ref}>
        <div className="pop-bar" />
        <div className="notif-pop__head">
          <span className="eyebrow">Notifications</span>
          <IconButton label="Close notifications" onClick={onDismiss}>
            <IconX size={15} />
          </IconButton>
        </div>

        {notifications.length === 0 ? (
          <div className="notif-pop__empty">
            <b>You’re all caught up.</b>
            <span>Pending approvals and decisions on your requests will show up here.</span>
          </div>
        ) : (
          <div className="notif-pop__list">
            {notifications.map((n) => {
              const Icon = KIND_ICONS[n.kind]
              return (
                <button
                  key={n.key}
                  type="button"
                  className={`notif-item${n.kind === 'approval' ? ' notif-item--approval' : ''}`}
                  onClick={() => onNavigate(n.to)}
                  title={n.kind === 'approval' ? 'Open the approval queue' : 'Open your request history'}
                >
                  <Icon size={16} />
                  <span className="notif-item__body">
                    <span className="notif-item__title">{n.title}</span>
                    <span className="notif-item__meta">{n.meta}</span>
                  </span>
                  <StatusPill status={n.status} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
