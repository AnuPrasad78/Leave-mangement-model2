import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { separationReasons } from '../data.js'
import { useAuth } from '../store/AuthContext'
import { supabase } from '../lib/supabase'
import { WarnBanner, ConfirmModal, Rise } from '../components/UI'

export default function SeparationRequest() {
  const navigate = useNavigate()
  const { setToast, profile } = useAuth()
  const [lwd, setLwd] = useState('')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)

  const submit = () => {
    const errs = {}
    const today = new Date().toISOString().slice(0, 10)
    if (!lwd) errs.lwd = 'Pick your proposed last working day.'
    if (lwd && lwd < today) errs.lwd = 'Last working day must be in the future.'
    if (!reason) errs.reason = 'Select a reason for separation.'
    if (!lwd || !reason || (lwd && lwd < today)) { setErrors(errs); return }
    setErrors({})
    setConfirming(true)
  }

  const confirmed = async () => {
    setConfirming(false)
    const { error } = await supabase
      .from('separation_requests')
      .insert({
        employee_id: profile?.id,
        last_working_day: lwd,
        reason,
        remarks: remarks.trim() ? remarks.trim() : null,
      })
    if (error) {
      setToast(error.message, 'red')
      return
    }
    setToast('Separation request raised · HR notified')
    navigate('/dashboard')
  }

  return (
    <div className="page">
      <Rise as="header" i={0} className="page-head">
        <span className="eyebrow" style={{ color: 'var(--red-deep)' }}>↘ 06 · Offboarding</span>
        <h1>Separation request.</h1>
        <p>Raise your intent to leave Emids. HR takes it from there — notice period, exit checklist, final settlement.</p>
      </Rise>

      <Rise i={1} className="card sep-card">
        <div className="sep-bar" />
        <div className="form-body">
          <WarnBanner>
            <b>READ BEFORE YOU SUBMIT</b>
            This initiates your formal offboarding at Emids. Once raised, taxes on your notice
            period begin immediately and HR is notified — the request cannot be withdrawn from
            this portal. Settlement follows the assignment policy on your account.
          </WarnBanner>

          <div className="form-row form-row--2">
            <label className="field">
              <span className="field__label">01 · Proposed Last Working Day <span className="req">*</span></span>
              <input
                className="input"
                type="date"
                value={lwd}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setLwd(e.target.value)}
              />
              {errors.lwd && <span className="mono muted">{errors.lwd}</span>}
            </label>
            <label className="field">
              <span className="field__label">02 · Reason for Separation <span className="req">*</span></span>
              <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {separationReasons.map((r) => <option key={r}>{r}</option>)}
              </select>
              {errors.reason && <span className="mono muted">{errors.reason}</span>}
            </label>
          </div>

          <label className="field">
            <span className="field__label">03 · Remarks</span>
            <textarea
              className="textarea"
              placeholder="Optional — anything the exit team should know: knowledge-transfer owners, asset returns, relocation timelines."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={800}
            />
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn--ghost" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button className="btn btn--danger" onClick={submit}>Submit Separation Request</button>
        </div>
      </Rise>

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
