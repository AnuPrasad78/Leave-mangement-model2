export function StatusPill({ status }) {
  const kind = {
    Approved: 'approved',
    Pending: 'pending',
    Rejected: 'rejected',
    Cancelled: 'cancelled',
  }[status] || 'cancelled'
  return <span className={`pill pill--${kind}`}>{status}</span>
}
