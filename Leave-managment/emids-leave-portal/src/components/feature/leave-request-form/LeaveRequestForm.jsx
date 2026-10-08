import { useMemo, useState } from 'react'
import { Button, Chip, Field, SegmentedControl } from '../../ui'
import { computeRequestDays, validateRequest } from '../../../features/leave-requests/computeRequest'
import { isOverdrawn, remainingAfter } from '../../../features/balances/rules'
import { todayISO } from '../../../utils/dates'
import { MODES } from '../../../constants'

export default function LeaveRequestForm({ leaveTypes, balances, addMine, onSubmitted, onCancel }) {
  const [type, setType] = useState('Paid Time Off')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState(MODES.Full)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})

  const days = useMemo(() => computeRequestDays({ from, to, mode }), [from, to, mode])

  const remaining = remainingAfter(balances, days)
  const fmt = (v) => (v == null ? '' : Number.isInteger(v) ? String(v) : v.toFixed(1))

  // Data guard: an overdrawn stored balance (utilized > credited + opening)
  // blocks new requests until the People Success desk corrects the ledger.
  const overdrawn = isOverdrawn(balances)

  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validateRequest({ type, from, to, reason })
    setErrors(errs)
    if (Object.keys(errs).length || !days) return
    setSubmitting(true)
    const id = await addMine({ type, from, to, days, mode, reason: reason.trim(), requestedOn: todayISO() })
    setSubmitting(false)
    if (!id) return
    onSubmitted(`${type} request submitted · ${days} day(s)`)
  }

  return (
    <form className="card form-card" onSubmit={submit} noValidate>
      <div className="form-body">
        <Field label="Leave Type" required as="div" error={errors.type}>
          <div className="chipbox">
            {leaveTypes.map((t) => (
              <Chip key={t} isOn={type === t} onClick={() => setType(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="form-row form-row--type">
          <Field label="From Date" required error={errors.from} htmlFor="lv-from">
            <input
              id="lv-from"
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To Date" required error={errors.to} htmlFor="lv-to">
            <input
              id="lv-to"
              className="input"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Day Mode" required as="div">
            <SegmentedControl value={mode} options={[MODES.Full, MODES.FirstHalf, MODES.SecondHalf]} onChange={setMode} ariaLabel="Day mode" />
          </Field>
          <div className="field">
            <span className="field__label">Number of days</span>
            <div className="form-days">
              {remaining != null && (
                remaining <= 0 ? (
                  <span className="form-days__rem">No available leave</span>
                ) : (<>
                  <span>Selected <b>{days ?? '—'}</b> day{days === 1 ? '' : 's'}</span>
                  <span className="form-days__rem">
                    Remaining <b>{fmt(remaining)}</b> days
                  </span></>
                )
              )}
              {overdrawn && <span className="form-days__rem">You have exceeded your available leave balance</span>}
            </div>
          </div>
        </div>

        <Field label="Reason" required error={errors.reason} htmlFor="lv-reason">
          <textarea
            id="lv-reason"
            className="textarea"
            placeholder="Approver reads this. Where you will be, coverage plans, anything the team should know."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </Field>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={overdrawn}
          title={overdrawn ? 'Annual balance shows used beyond credited + opening — ask the People Success desk to correct the ledger first.' : undefined}
          busy={submitting}
          busyLabel="Submitting…"
        >
          Submit Request
        </Button>
      </div>
    </form>
  )
}
