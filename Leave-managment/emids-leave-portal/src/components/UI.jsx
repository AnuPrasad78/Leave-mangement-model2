import { useAuth } from '../store/AuthContext'
import { IconAlertTriangle, IconCheck, IconBan, IconX } from './Icons'

export function StatusPill({ status }) {
  const kind = {
    Approved: 'approved',
    Pending: 'pending',
    Rejected: 'rejected',
    Cancelled: 'cancelled',
  }[status] || 'cancelled'
  return <span className={`pill pill--${kind}`}>{status}</span>
}

export function Toast() {
  const { toast } = useAuth()
  if (!toast) return null
  return (
    <div className={`toast ${toast.kind === 'red' ? 'toast--red' : ''}`} key={toast.id}>
      <span className="toast__dot" />
      <span>{toast.msg}</span>
    </div>
  )
}

export function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__bar" />
        <div className="modal__body">
          <div className="modal__title">{title}</div>
          <p className="modal__text">{text}</p>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={onClose}>
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

export function Donut({ used, total, size = 190, label }) {
  const r = size * 0.39
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const frac = total > 0 ? used / total : 0
  const usedLen = circ * frac
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--teal-light)" strokeWidth="20" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--teal)"
        strokeWidth="20"
        strokeDasharray={`${usedLen} ${circ - usedLen}`}
        strokeLinecap="butt"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" className="donut__big">
        {Math.round(frac * 100)}%
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" className="donut__sub">
        {label}
      </text>
    </svg>
  )
}

export function WarnBanner({ children }) {
  return (
    <div className="warn-banner">
      <IconAlertTriangle size={20} />
      <div>{children}</div>
    </div>
  )
}
