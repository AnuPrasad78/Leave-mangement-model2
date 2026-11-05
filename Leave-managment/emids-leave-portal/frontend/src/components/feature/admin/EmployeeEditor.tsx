import { useState } from 'react'
import { Button, Field } from '../../ui'
import { todayISO } from '../../../utils/dates'
import type { EmployeeAdminRow, EmployeeCreateInput, EmployeeUpdateInput } from '../../../types/models'

export interface ManagerOption {
  id: string
  full_name: string | null
  emp_no: string | null
}

export interface EmployeeEditorProps {
  mode: 'create' | 'edit'
  row: EmployeeAdminRow | null
  managers: ManagerOption[]
  busy?: boolean
  onSubmit: (payload: EmployeeCreateInput | EmployeeUpdateInput, id?: string) => void
  onDismiss: () => void
}

const fieldNames = [
  { key: 'full_name', label: 'Full Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'job_title', label: 'Job Title', type: 'text', required: false },
  { key: 'doj', label: 'Date of Joining', type: 'date', required: false },
  { key: 'location', label: 'Location (optional)', type: 'text', required: false },
]

export function EmployeeEditor({ mode, row, managers, busy, onSubmit, onDismiss }: EmployeeEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    full_name: row?.full_name ?? '',
    email: row?.email ?? '',
    job_title: row?.job_title ?? '',
    // New hires join today unless the admin says otherwise — the editor
    // prefills Date of Joining instead of leaving it blank.
    doj: row?.doj ?? (mode === 'create' ? todayISO() : ''),
    manager_id: row?.manager_id ?? '',
    location: row?.location ?? '',
  }))
  const [role, setRole] = useState(row?.system_role === 'manager' ? 'manager' : 'employee')
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const submit = () => {
    if (mode === 'create') {
      const create: EmployeeCreateInput = {
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        system_role: role === 'manager' ? 'manager' : 'employee',
        job_title: values.job_title || null,
        doj: values.doj || null,
        manager_id: values.manager_id || null,
        location: values.location || null,
        temporary_password: temporaryPassword || null,
      }
      onSubmit(create)
      return
    }
    const update: EmployeeUpdateInput = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      job_title: values.job_title || null,
      doj: values.doj || null,
      manager_id: values.manager_id || null,
      location: values.location || null,
    }
    onSubmit(update, row?.id)
  }

  const getError = (key: string): string | undefined => {
    const def = fieldNames.find((f) => f.key === key)
    if (def?.required && !values[key]?.trim()) return `${def.label} is required`
    return undefined
  }

  return (
    <div className="admin-editor" role="dialog" aria-modal="true" aria-label={`${mode === 'create' ? 'Add' : 'Edit'} employee`}>
      <div className="hl-panel-head">
        <h3>{mode === 'create' ? 'Add employee' : `Edit ${row?.full_name}`}</h3>
        <Button variant="ghost" onClick={onDismiss} aria-label="Close editor">
          Close
        </Button>
      </div>
      <div className="form-body">
        {fieldNames.map(({ key, label, type, required }) => (
          <Field key={key} label={label} required={required} htmlFor={`emp-${key}`} error={getError(key)}>
            <input
              id={`emp-${key}`}
              className="input"
              type={type}
              value={values[key]}
              onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
            />
          </Field>
        ))}
        <Field label="Manager (optional)" htmlFor="emp-manager_id">
          <select
            id="emp-manager_id"
            className="input"
            value={values.manager_id}
            onChange={(event) => setValues((prev) => ({ ...prev, manager_id: event.target.value }))}
          >
            <option value="">(none)</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.full_name ?? manager.id}
                {manager.emp_no ? ` (${manager.emp_no})` : ''}
              </option>
            ))}
          </select>
        </Field>
        {mode === 'create' && (
          <>
            <Field label="Role" htmlFor="emp-role">
              <select
                id="emp-role"
                className="input"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
            <Field label="Temporary password (leave blank to auto-generate)" htmlFor="emp-temp-password">
              <input
                id="emp-temp-password"
                className="input"
                type="text"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <div className="admin-editor__actions">
        <Button variant="primary" onClick={submit} busy={busy}>
          {mode === 'create' ? 'Save employee' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
