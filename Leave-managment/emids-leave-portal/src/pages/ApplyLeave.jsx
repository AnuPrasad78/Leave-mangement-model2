import { useMemo, useState } from 'react'
import { businessDaysBetween } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { useNavigate } from 'react-router-dom'

const MODES = ['Full Day', 'First Half', 'Second Half']

export default function ApplyLeave() {
  const navigate = useNavigate()
  const { setToast, addMine, leaveTypes, balances } = useAuth()
  const [type, setType] = useState('Paid Time Off')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState('Full Day')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})

  const days = useMemo(() => {
    if (!from || !to) return null
    if (to < from) return null
    const n = businessDaysBetween(from, to)
    if (mode !== 'Full Day') return Math.max(0.5, n * 0.5)
    return n
  }, [from, to, mode])

  const available = balances ? balances.totalCredited - balances.utilized : null
  const remaining = days != null && available != null ? available - days : null
  const fmt = (v) => (v == null ? '' : Number.isInteger(v) ? String(v) : v.toFixed(1))

  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!type) errs.type = 'Select a leave type.'
    if (!from) errs.from = 'Pick a from date.'
    if (!to) errs.to = 'Pick a to date.'
    if (from && to && to < from) errs.to = 'End date is before the start date.'
    if (reason.trim().length < 5) errs.reason = 'Tell the approver why, in a line or two.'
    setErrors(errs)
    if (Object.keys(errs).length || !days) return
    setSubmitting(true)
    const id = await addMine({ type, from, to, days, mode, reason: reason.trim(), requestedOn: new Date().toISOString().slice(0, 10) })
    setSubmitting(false)
    if (!id) return
    setToast(`${type} request submitted · ${days} day(s)`)
    navigate('/leave-details')
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">New Request</span>
        <h1>Request time off.</h1>
      </header>

      <form className="card form-card" onSubmit={submit} noValidate>
        <div className="form-body">
          <div className="field">
            <span className="field__label">Leave Type <span className="req">*</span></span>
            <div className="chipbox">
              {leaveTypes.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`chip ${type === t ? 'is-on' : ''}`}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.type && <span className="muted mono">{errors.type}</span>}
          </div>

          <div className="form-row form-row--type">
            <label className="field">
              <span className="field__label">From Date <span className="req">*</span></span>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              {errors.from && <span className="muted mono">{errors.from}</span>}
            </label>
            <label className="field">
              <span className="field__label">To Date <span className="req">*</span></span>
              <input
                className="input"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
              {errors.to && <span className="muted mono">{errors.to}</span>}
            </label>
            <label className="field">
              <span className="field__label">Day Mode <span className="req">*</span></span>
              <div className="seg" role="group" aria-label="Day mode">
                {MODES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={mode === m ? 'is-on' : ''}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </label>
            <div className="field">
              <span className="field__label">Number of days</span>
              <div className="form-days">
                <span>Selected <b>{days ?? '—'}</b> day{days === 1 ? '' : 's'}</span>
                {remaining != null && (
                  <span className="form-days__rem">
                    Remaining <b>{fmt(remaining)}</b> days
                  </span>
                )}
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field__label">Reason <span className="req">*</span></span>
            <textarea
              className="textarea"
              placeholder="Approver reads this. Where you will be, coverage plans, anything the team should know."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            {errors.reason && <span className="muted mono">{errors.reason}</span>}
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/dashboard')}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  )
}
