import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Field, SegmentedControl, WarnBanner } from '../../ui'
import { useDismiss } from '../../../hooks/useDismiss'
import { activeReportsOf, editIssues } from '../../../features/admin/editEmployee'
import type { EditPick } from '../../../features/admin/editEmployee'
import { fmtDate } from '../../../utils/dates'
import type { EmployeeAdminRow, SystemRole } from '../../../types/models'
import { IconX } from '../../Icons'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface EditPersonModalProps {
  person: EmployeeAdminRow
  /** Live directory — resolves manager picks and runs the settled-team guard. */
  people: EmployeeAdminRow[]
  /** Employee id of the signed-in admin (self-role changes are refused). */
  viewerId: string | null
  /** Persistence: resolves to an error string, or null once saved. */
  onApply: (pick: EditPick) => Promise<string | null>
  onClose: () => void
}

const ROLE_OPTIONS: SystemRole[] = ['employee', 'manager', 'admin']
const STATUS_OPTIONS = ['Active', 'Inactive'] as const

/**
 * ORGANISM — the roster edit dialog. Owns the pick + live issue checks; the
 * page owns persistence. Identity fields (name, email, emp no, DOJ) are
 * intentionally not editable here — Admin · Employees owns hiring.
 */
export function EditPersonModal({ person, people, viewerId, onApply, onClose }: EditPersonModalProps) {
  const [pick, setPick] = useState<EditPick>(() => ({
    system_role: person.system_role,
    is_active: person.is_active,
    job_title: person.job_title ?? '',
    manager_id: person.manager_id ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, { onClose })

  // Focus + escape/Tab rules mirror ConfirmModal.
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!ref.current?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [onClose])

  const issues = useMemo(() => editIssues(pick, person, people, viewerId), [pick, person, people, viewerId])
  const reports = useMemo(() => activeReportsOf(person.id, people), [person, people])

  // Manager options: active managers, never the person themselves.
  const managers = useMemo(
    () =>
      people
        .filter(
          (candidate) =>
            candidate.system_role !== 'employee' && candidate.is_active && candidate.id !== person.id
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [people, person]
  )

  const set = <K extends keyof EditPick>(key: K, value: EditPick[K]) => {
    setPick((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
  }

  const save = async () => {
    if (issues.blocker || Object.keys(issues.fields).length > 0) return
    setBusy(true)
    const error = await onApply(pick)
    setBusy(false)
    if (error) {
      setSaveError(error)
      return
    }
    onClose() // success: the page unmounts the dialog
  }

  const steppingAway =
    person.system_role === 'manager' &&
    (pick.system_role === 'employee' || !pick.is_active)

  return (
    <div className="admin-overlay" role="presentation">
      <div className="admin-modal admin-modal--narrow">
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Edit ${person.full_name}`} ref={ref}>
          <div className="hl-panel-head">
            <h3>Edit {person.full_name}</h3>
            <button className="pills-act" aria-label="Close editor" onClick={onClose}>
              <IconX size={15} />
            </button>
          </div>
          <div className="form-body">
            <p className="roster-who mono">
              {person.emp_no} · {person.email}
              {person.doj ? ` · joined ${fmtDate(person.doj)}` : ''}
            </p>

            <form
              className="form-body"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <div className="admin-editor-row">
                <Field label="Directory role" required as="div">
                  <SegmentedControl
                    value={pick.system_role}
                    options={ROLE_OPTIONS}
                    ariaLabel="Directory role"
                    onChange={(role) => set('system_role', role)}
                  />
                </Field>
                <Field label="Status" required as="div">
                  <span className="seg" role="group" aria-label="Status">
                    {STATUS_OPTIONS.map((status) => {
                      const wanted: boolean = status === 'Active'
                      return (
                        <button
                          type="button"
                          key={status}
                          className={pick.is_active === wanted ? 'is-on' : ''}
                          aria-pressed={pick.is_active === wanted}
                          disabled={busy}
                          onClick={() => set('is_active', wanted)}
                        >
                          {status}
                        </button>
                      )
                    })}
                  </span>
                </Field>
              </div>

              <Field label="Job title" required error={issues.fields.job_title} htmlFor="ep-title">
                <input
                  id="ep-title"
                  className="input"
                  value={pick.job_title}
                  disabled={busy}
                  onChange={(event) => set('job_title', event.target.value)}
                  placeholder="e.g. Senior Engineer"
                />
              </Field>

              <Field
                label="Reports to"
                required={pick.system_role === 'employee'}
                error={issues.fields.manager_id}
                htmlFor="ep-manager"
              >
                <select
                  id="ep-manager"
                  className="input"
                  value={pick.manager_id}
                  disabled={busy || pick.system_role !== 'employee'}
                  onChange={(event) => set('manager_id', event.target.value)}
                >
                  <option value="">— Select a manager —</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name} · {manager.job_title ?? ''}
                    </option>
                  ))}
                </select>
              </Field>

              {steppingAway && reports.length > 0 && (
                <WarnBanner>
                  <b>Team first</b> {person.full_name} has {reports.length} active direct{' '}
                  {reports.length === 1 ? 'report' : 'reports'} — reassign or retire them before
                  leaving the manager role or going inactive.
                </WarnBanner>
              )}

              {issues.blocker && (
                <WarnBanner>
                  <b>Blocked</b> {issues.blocker}
                </WarnBanner>
              )}

              {issues.fields.system_role && (
                <WarnBanner>
                  <b>Not allowed</b> {issues.fields.system_role}
                </WarnBanner>
              )}

              {saveError && (
                <WarnBanner>
                  <b>Not saved</b> {saveError}
                </WarnBanner>
              )}
            </form>
          </div>
          <div className="admin-editor__actions">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={busy || Boolean(issues.blocker) || Object.keys(issues.fields).length > 0}
              busy={busy}
              busyLabel="Saving…"
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
