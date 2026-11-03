import { useCallback, useEffect, useState } from 'react'
import { Button, Field, PageHead, Pager } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { usePagedData } from '../hooks/usePagedData'
import { TOAST_KIND } from '../constants'
import { fetchAdminBalances, fetchLeavePolicies, adminUpsertBalance } from '../services/admin'
import type { AdminBalanceRow, BalanceUpsertInput, LeavePolicyConfig } from '../types/models'

const CURRENT_YEAR = new Date().getFullYear()

export default function AdminLeavePolicies() {
  const { setToast } = useAuth()
  const [config, setConfig] = useState<LeavePolicyConfig | null>(null)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<AdminBalanceRow | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [form, setForm] = useState({ annual_credited: '', contingency_credited: '', opening_annual: '', annual_cap: '', contingency_cap: '' })

  useEffect(() => {
    let mounted = true
    fetchLeavePolicies().then(({ config: fresh, error }) => {
      if (!mounted) return
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setConfig(fresh)
    })
    return () => {
      mounted = false
    }
  }, [setToast])

  const fetcher = useCallback((page: number) => fetchAdminBalances(year, page), [year])
  const { rows, total, page, pageCount, setPage, loading } = usePagedData<AdminBalanceRow>({
    fetcher,
    resetKeys: [year],
    reloadNonce,
  })

  const startEdit = (row: AdminBalanceRow) => {
    setEditing(row)
    setForm({
      annual_credited: String(row.annual_credited ?? ''),
      contingency_credited: String(row.contingency_credited ?? ''),
      opening_annual: String(row.opening_annual ?? ''),
      annual_cap: String(row.annual_cap ?? ''),
      contingency_cap: String(row.contingency_cap ?? ''),
    })
  }

  const submitEdit = async () => {
    if (!editing) return
    const input: BalanceUpsertInput = {}
    const asNumber = (value: string): number | null => (value === '' ? null : Number(value))
    input.annual_credited = asNumber(form.annual_credited)
    input.contingency_credited = asNumber(form.contingency_credited)
    input.opening_annual = asNumber(form.opening_annual)
    input.annual_cap = asNumber(form.annual_cap)
    input.contingency_cap = asNumber(form.contingency_cap)
    setBusy(true)
    try {
      const { error } = await adminUpsertBalance(editing.employee_id, editing.year, input)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setToast('Balance saved', TOAST_KIND.Ok)
      setEditing(null)
      setReloadNonce((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="Leave policies." accent>
        <p>The credit policy the portal enforces, and the org-wide balance sheet.</p>
      </PageHead>

      <div className="card admin-policy">
        <h3>Credit policy</h3>
        {config ? (
          <dl className="admin-policy-list">
            <div><dt>Annual days / year</dt><dd>{config.annual_days_per_year} (prorated by DOJ: {config.proration_method})</dd></div>
            <div><dt>Contingency days / year</dt><dd>{config.contingency_days_per_year}</dd></div>
            <div><dt>Carry-forward ceiling</dt><dd>{config.carry_forward_max}</dd></div>
            <div><dt>Optional holiday picks</dt><dd>{config.optional_holidays_max} / person / year</dd></div>
          </dl>
        ) : (
          <p>Loading policy…</p>
        )}
      </div>

      <div className="card admin-balances">
        <div className="hl-panel-head">
          <h3>Balances</h3>
          <div className="hl-panel-head__right">
            <select className="input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Opening</th>
                <th>Credited</th>
                <th>Utilized</th>
                <th>Cap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="table__empty">
                    {loading ? 'Loading balances…' : `No balances recorded for ${year}.`}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.employee_id}>
                  <td><b>{row.employee.full_name}</b> <span className="muted">{row.employee.emp_no}</span></td>
                  <td>{row.opening_annual}</td>
                  <td>{row.annual_credited}</td>
                  <td>{row.annual_utilized} (contingency {row.contingency_utilized})</td>
                  <td>{row.annual_cap}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>Adjust</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-count">Total {total}</p>
        <Pager page={page} pageCount={pageCount} onChange={setPage} />
      </div>

      {editing && (
        <div className="admin-overlay" role="presentation">
          <div className="admin-modal admin-modal--narrow">
            <div className="hl-panel-head">
              <h3>Adjust balance · {editing.employee.full_name} ({editing.year})</h3>
              <Button variant="ghost" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <div className="form-body">
              <p>Utilized days are never editable here — credits and caps must stay at or above them.</p>
              {(['opening_annual', 'annual_credited', 'contingency_credited', 'annual_cap', 'contingency_cap'] as const).map((key) => (
                <Field key={key} label={key.replace(/_/g, ' ')} htmlFor={`bal-${key}`}>
                  <input
                    id={`bal-${key}`}
                    className="input"
                    type="number"
                    step="0.5"
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </Field>
              ))}
            </div>
            <div className="admin-editor__actions">
              <Button variant="primary" onClick={submitEdit} busy={busy}>Save balance</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

