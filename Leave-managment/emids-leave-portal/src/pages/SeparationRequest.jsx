import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { separationReasons, TOAST_KIND } from '../constants'
import { todayISO } from '../utils/dates'
import { useAuth } from '../store/AuthContext'
import { createSeparationRequest } from '../services/separations'
import { validateSeparation } from '../features/separations/validateSeparation'
import { Button, ConfirmModal, Field, PageHead, WarnBanner } from '../components/ui'

export default function SeparationRequest() {
  const navigate = useNavigate()
  const { setToast, profile } = useAuth()
  const [lwd, setLwd] = useState('')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)

  const submit = () => {
    const errs = validateSeparation({ lwd, reason })
    setErrors(errs)
    if (Object.keys(errs).length) return
    setConfirming(true)
  }

  const confirmed = async () => {
    setConfirming(false)
    const { error } = await createSeparationRequest({
      employee_id: profile?.id,
      last_working_day: lwd,
      reason,
      remarks: remarks.trim() ? remarks.trim() : null,
    })
    if (error) {
      setToast(error.userMessage, TOAST_KIND.Error)
      return
    }
    setToast('Separation request raised · HR notified')
    navigate('/dashboard')
  }

  return (
    <div className="page">
      <PageHead eyebrow="Offboarding" title="Separation request." accent>
        <p>Raise your intent to leave Emids. HR takes it from there — notice period, exit checklist, final settlement.</p>
      </PageHead>

      <div className="card sep-card">
        <div className="sep-bar" />
        <div className="form-body">
          <WarnBanner>
            <b>READ BEFORE YOU SUBMIT</b>
            This initiates your formal offboarding at Emids. Once raised, taxes on your notice
            period begin immediately and HR is notified — the request cannot be withdrawn from
            this portal. Settlement follows the assignment policy on your account.
          </WarnBanner>

          <div className="form-row form-row--2">
            <Field label="Proposed Last Working Day" required htmlFor="sep-lwd" error={errors.lwd}>
              <input
                id="sep-lwd"
                className="input"
                type="date"
                value={lwd}
                min={todayISO()}
                onChange={(e) => setLwd(e.target.value)}
              />
            </Field>
            <Field label="Reason for Separation" required htmlFor="sep-reason" error={errors.reason}>
              <select id="sep-reason" className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {separationReasons.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Remarks" htmlFor="sep-remarks">
            <textarea
              id="sep-remarks"
              className="textarea"
              placeholder="Optional — anything the exit team should know: knowledge-transfer owners, asset returns, relocation timelines."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={800}
            />
          </Field>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>Cancel</Button>
          <Button variant="danger" onClick={submit}>Submit Separation Request</Button>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title="Raise separation request?"
          text="HR and your reporting manager are notified the moment you confirm. The notice period calculation begins from your next working day."
          confirmLabel="Confirm & notify HR"
          danger
          onConfirm={confirmed}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
