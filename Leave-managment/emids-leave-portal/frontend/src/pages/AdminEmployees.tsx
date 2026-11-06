import { useEffect, useState } from 'react'
import { Button, ConfirmModal, Field, PageHead, Pager } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useAdmin } from '../store/AdminContext'
import { TOAST_KIND } from '../constants'
import { fetchAdminEmployees } from '../services/admin'
import { EmployeeTable } from '../components/feature/admin/EmployeeTable'
import { EmployeeEditor, type ManagerOption } from '../components/feature/admin/EmployeeEditor'
import type { EmployeeAdminRow } from '../types/models'

type PendingToggle = { row: EmployeeAdminRow; toActive: boolean } | null

export default function AdminEmployees() {
  const { setToast } = useAuth()
  const { employees, total, page, pageCount, setPage, loading, search, setSearch, createEmployee, updateEmployee, setEmployeeActive, initPasswordReset } = useAdmin()

  const [busy, setBusy] = useState(false)
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingRow, setEditingRow] = useState<EmployeeAdminRow | null>(null)
  const [managers, setManagers] = useState<ManagerOption[]>([])
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null)
  const [resetTarget, setResetTarget] = useState<EmployeeAdminRow | null>(null)
  const [resetPayload, setResetPayload] = useState<{ token: string; endpoint: string } | null>(null)

  useEffect(() => {
    if (editorMode === 'closed') setEditingRow(null)
  }, [editorMode])

  useEffect(() => {
    if (editorMode === 'closed') return
    let alive = true
    void fetchAdminEmployees({ role: 'manager', active: true, pageSize: 100, sort: 'full_name' }).then(
      (result) => {
        if (!alive || result.error) return
        setManagers(result.page.rows.map(({ id, full_name, emp_no }) => ({ id, full_name, emp_no })))
      }
    )
    return () => {
      alive = false
    }
  }, [editorMode])

  const submitEditor = async (payload: unknown, id?: string) => {
    setBusy(true)
    try {
      if (editorMode === 'create') {
        const result = await createEmployee(payload as Parameters<typeof createEmployee>[0])
        if (result) {
          const generated = result.temporary_password
          setEditorMode('closed')
          setToast(generated ? `Employee added · one-time password: ${generated}` : 'Employee added', TOAST_KIND.Ok)
        }
      } else if (editorMode === 'edit' && id) {
        const updated = await updateEmployee(id, payload as Parameters<typeof updateEmployee>[1])
        if (updated) setEditorMode('closed')
      }
    } catch {
      setToast('The change could not be confirmed. Reload before trying again.', TOAST_KIND.Error)
    } finally {
      setBusy(false)
    }
  }

  const confirmToggle = async () => {
    if (!pendingToggle) return
    setBusy(true)
    try {
      await setEmployeeActive(pendingToggle.row.id, pendingToggle.toActive)
      setPendingToggle(null)
    } finally {
      setBusy(false)
    }
  }

  const startReset = async (row: EmployeeAdminRow) => {
    setResetTarget(row)
    setResetPayload(null)
    setBusy(true)
    try {
      if (!row.user_id) return
      const init = await initPasswordReset(row.user_id)
      if (init) setResetPayload({ token: init.reset_token, endpoint: init.reset_endpoint })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Administration" title="People." accent>
        <p>Add colleagues, fix profiles and manage logins. Every change lands in the audit trail.</p>
      </PageHead>

      <div className="card admin-toolbar">
        <Field label="Search" htmlFor="admin-employee-search">
          <input
            id="admin-employee-search"
            className="input"
            type="search"
            placeholder="Name, email or emp no…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Button variant="primary" onClick={() => setEditorMode('create')}>
          Add employee
        </Button>
      </div>

      <EmployeeTable
        rows={loading && !employees.length ? [] : employees}
        rowKey={(row) => row.id}
        onEdit={(row) => {
          setEditingRow(row)
          setEditorMode('edit')
        }}
        onToggleActive={(row) => setPendingToggle({ row, toActive: !row.is_active })}
        onResetPassword={startReset}
        empty={loading ? 'Loading people…' : undefined}
      />
      <p className="admin-count">Total {total}</p>
      <Pager page={page} pageCount={pageCount} onChange={setPage} />

      {(editorMode === 'create' || editorMode === 'edit') && (
        <div className="admin-overlay" role="presentation">
          <div className="admin-modal">
            <EmployeeEditor
              mode={editorMode}
              row={editingRow}
              managers={managers}
              busy={busy}
              onSubmit={submitEditor}
              onDismiss={() => setEditorMode('closed')}
            />
          </div>
        </div>
      )}

      {pendingToggle && (
        <ConfirmModal
          title={pendingToggle.toActive ? `Activate ${pendingToggle.row.full_name}?` : `Deactivate ${pendingToggle.row.full_name}?`}
          text={
            pendingToggle.toActive
              ? 'They will be able to sign in again after this.'
              : 'They will be signed out and blocked from logging in. Their history stays untouched.'
          }
          confirmLabel={pendingToggle.toActive ? 'Activate' : 'Deactivate'}
          danger={!pendingToggle.toActive}
          busy={busy}
          onConfirm={confirmToggle}
          onClose={() => setPendingToggle(null)}
        />
      )}

      {resetTarget && (
        <div className="admin-overlay" role="presentation">
          <div className="admin-modal admin-modal--narrow">
            <div className="hl-panel-head">
              <h3>Password reset · {resetTarget.full_name}</h3>
              <Button variant="ghost" onClick={() => setResetTarget(null)}>
                Close
              </Button>
            </div>
            <div className="form-body">
              {resetPayload ? (
                <>
                  <p>
                    Hand this one-time token to them directly. It expires in 60 minutes, works exactly once
                    and the old password stops working immediately after use.
                  </p>
                  <Field label="POST endpoint (with their new password in the body)" htmlFor="admin-reset-endpoint">
                    <input
                      id="admin-reset-endpoint"
                      className="input"
                      type="text"
                      readOnly
                      value={`${resetPayload.endpoint}`}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </Field>
                  <Field label="Token" htmlFor="admin-reset-token">
                    <input
                      id="admin-reset-token"
                      className="input"
                      type="text"
                      readOnly
                      value={resetPayload.token}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </Field>
                </>
              ) : (
                <p>{busy ? 'Generating one-time token…' : 'Generating…'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

