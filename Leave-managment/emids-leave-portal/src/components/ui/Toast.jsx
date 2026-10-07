import { useAuth } from '../../store/AuthContext'

export function Toast() {
  const { toast } = useAuth()
  if (!toast) return null
  return (
    <div className={`toast ${toast.kind === 'red' ? 'toast--red' : ''}`} key={toast.id} role='status' aria-live='polite'>
      <span className="toast__dot" />
      <span>{toast.msg}</span>
    </div>
  )
}
