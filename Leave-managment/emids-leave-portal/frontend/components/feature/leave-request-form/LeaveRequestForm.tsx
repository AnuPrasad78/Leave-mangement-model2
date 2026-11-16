import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Chip, Field, SegmentedControl } from '../../ui'
import { computeRequestDays, validateRequest } from '../../../features/leave-requests/computeRequest'
import type { RequestValidationErrors } from '../../../features/leave-requests/computeRequest'
import OptionalHolidayCalendar from './OptionalHolidayCalendar'
import { isOverdrawn, remainingAfter } from '../../../features/balances/rules'
import { todayISO } from '../../../utils/dates'
import { MODES } from '../../../constants'
import type { BalanceSummary, LeaveRequestInput, LeaveRequestRow, LeaveRequestUpdateInput, LeaveMode } from '../../../types/models'

export interface LeaveRequestFormProps {
  leaveTypes: string[]
  balances: BalanceSummary | null
  /** The user's Holiday-Calendar optional picks (date → name). Gates the
   * "Optional Holiday" leave type: that date must be among the picks. */
  pickedOptionalHolidays?: Map<string, string> | null
  addMine?: (input: LeaveRequestInput) => Promise<string | null>
  updateMine?: (id: string, input: LeaveRequestUpdateInput) => Promise<boolean>
  editRequest?: LeaveRequestRow
  onSubmitted: (message: string) => void
  onError: (message: string) => void
  onCancel: () => void
}

export default function LeaveRequestForm({ leaveTypes, balances, pickedOptionalHolidays, addMine, updateMine, editRequest, onSubmitted, onError, onCancel }: LeaveRequestFormProps) {
  const [type, setType] = useState(editRequest?.type ?? 'Paid Time Off')
  const [from, setFrom] = useState(editRequest?.from ?? '')
  const [to, setTo] = useState(editRequest?.to ?? '')
  const [mode, setMode] = useState<LeaveMode>(editRequest?.mode ?? MODES.Full)
  const [reason, setReason] = useState(editRequest?.reason ?? '')
  const [errors, setErrors] = useState<RequestValidationErrors>({})

  const isOptionalHoliday = type.toLowerCase().includes('optional holiday')

  const pickType = (t: string) => {
    setType(t)
    // Optional holidays are single full days; collapse any stale range and
    // drop half-day modes so the calendar drives one-date selection.
    if (t.toLowerCase().includes('optional holiday')) {
      setMode(MODES.Full)
      if (from) setTo(from)
    }
  }

  const days = useMemo(
    () => computeRequestDays({ from, to, mode, isOptionalHoliday }),
    [from, to, mode, isOptionalHoliday]
  )

  const remaining = remainingAfter(balances, days)
  const fmt = (v: number) => (v == null ? '' : Number.isInteger(v) ? String(v) : v.toFixed(1))

  // From/To errors are shown as one full-width line under the dates row so a
  // long sentence (e.g. the optional-holiday gate) doesn't wrap five lines
  // inside a quarter-width date column.
  const dateErrors = [errors.from, errors.to].filter((v): v is string => Boolean(v))

  // Data guard: an overdrawn stored balance (utilized > credited + opening)
  // blocks new requests until the People Success desk corrects the ledger.
  const overdrawn = isOverdrawn(balances)

  const [submitting, setSubmitting] = useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errs = validateRequest({ type, from, to, reason, pickedOptionalHolidays: pickedOptionalHolidays ?? undefined })
    setErrors(errs)
    if (Object.keys(errs).length || !days) return
    setSubmitting(true)
    try {
      if (editRequest) {
        if (!updateMine) throw new Error('Request editing is unavailable. Please try again.')
        const updated = await updateMine(editRequest.id, { type, from, to, days, mode, reason: reason.trim() })
        if (!updated) return
        onSubmitted(`${type} request updated · ${days} day(s)`)
        return
      }
      if (!addMine) throw new Error('Request submission is unavailable. Please try again.')
      const id = await addMine({ type, from, to, days, mode, reason: reason.trim(), requestedOn: todayISO() })
      if (!id) return
      onSubmitted(`${type} request submitted · ${days} day(s)`)
    } catch (error) {
      if (error instanceof Error && error.name === 'OutcomeUnknownError') setOutcomeUnknown(true)
      onError(error instanceof Error ? error.message : 'The request outcome could not be confirmed. Check My Requests before trying again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={submit} noValidate>
      <div className="form-body">
        <Field label="Leave Type" required as="div" error={errors.type}>
          <div className="chipbox">
            {leaveTypes.map((t) => (
              <Chip key={t} isOn={type === t} onClick={() => pickType(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="form-row form-row--type">
          {isOptionalHoliday ? (
            <div className="field opt-calendar-field">
              <span className="field__label">
                Optional Holiday Date <span className='req'>*</span>
              </span>
              {pickedOptionalHolidays ? (
                <OptionalHolidayCalendar
                  picked={pickedOptionalHolidays}
                  selected={from}
                  onSelect={(d) => {
                    setFrom(d)
                    setTo(d)
                  }}
                />
              ) : (
                <span className="opt-calendar__loading">Loading your optional holiday picks…</span>
              )}
            </div>
          ) : (
            <>
              <Field label="From Date" required htmlFor="lv-from">
                <input
                  id="lv-from"
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="To Date" required htmlFor="lv-to">
                <input
                  id="lv-to"
                  className="input"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </>
          )}
          {!isOptionalHoliday && (
            <Field label="Day Mode" required as="div">
              <SegmentedControl value={mode} options={[MODES.Full, MODES.FirstHalf, MODES.SecondHalf]} onChange={setMode} ariaLabel="Day mode" />
            </Field>
          )}
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

          {dateErrors.length > 0 && (
            <span className="form-date-error mono">{dateErrors.join(' ')}</span>
          )}
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
          disabled={(!editRequest && overdrawn) || outcomeUnknown}
          title={!editRequest && overdrawn ? 'Annual balance shows used beyond credited + opening — ask the People Success desk to correct the ledger first.' : undefined}
          busy={submitting}
          busyLabel={editRequest ? 'Saving…' : 'Submitting…'}
        >
          {editRequest ? 'Save Changes' : 'Submit Request'}
        </Button>
      </div>
    </form>
  )
}
