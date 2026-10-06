import { useMemo, useState } from 'react'
import { businessDaysBetween } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { useNavigate } from 'react-router-dom'

const MODES = ['Full Day', 'First Half', 'Second Half']

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ApplyLeave() {
  const navigate = useNavigate()
  const { setToast, addMine, leaveTypes } = useAuth()
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

  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!type) errs.type = 'Select a leave type.'
    if (!from) errs.from = 'Pick a from date.'
    if (!to) errs.to = 'Pick a to date.'
    if (from && from < todayIso()) errs.from = 'Leave cannot start in the past.'
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
        <span className="eyebrow">↘ 02 · New Request</span>
        <h1>Request time off.</h1>
      </header>

      <form className="card form-card" onSubmit={submit} noValidate>
        <div className="form-body">
          <div className="field">
            <span className="field__label">01 · Leave Type <span className="req">*</span></span>
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
              <span className="field__label">02 · From Date <span className="req">*</span></span>
              <input
                className="input"
                type="date"
                min={todayIso()}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              {errors.from && <span className="muted mono">{errors.from}</span>}
            </label>
            <label className="field">
              <span className="field__label">03 · To Date <span className="req">*</span></span>
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
              <span className="field__label">04 · Day Mode <span className="req">*</span></span>
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
              <span className="field__label">05 · Working Days</span>
              <div className="form-days">
                CREDITED <b>{days ?? '—'}</b> DAY{days === 1 ? '' : 'S'}
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field__label">06 · Reason <span className="req">*</span></span>
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
