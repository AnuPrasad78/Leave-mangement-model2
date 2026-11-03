import { useCallback, useEffect, useState } from 'react'
import { PageHead } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { useAdmin } from '../store/AdminContext'
import { TOAST_KIND } from '../constants'
import { adminSetEmployeeActive, adminUpdateEmployee, fetchAdminEmployees } from '../services/admin'
import { RosterDesk } from '../components/feature/admin/RosterDesk'
import { EditPersonModal } from '../components/feature/admin/EditPersonModal'
import { editPayload } from '../features/admin/editEmployee'
import type { EditPick } from '../features/admin/editEmployee'
import type { EmployeeAdminRow } from '../types/models'

export default function AdminRoster() {
  const { setToast, profile } = useAuth()
  const { reload } = useAdmin()

  const [people, setPeople] = useState<EmployeeAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmployeeAdminRow | null>(null)

  // The roster keeps its own copy so filtering, pager and modal never fight
  // the employees page's shared context; every save re-pulls the directory.
  const load = useCallback(() => {
    setLoading(true)
    fetchAdminEmployees('').then(({ page, error }) => {
      setLoading(false)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return
      }
      setPeople(page.items)
    })
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  // Persistence lives on the page; the dialog only composes the pick.
  const apply = async (pick: EditPick): Promise<string | null> => {
    if (!editing) return 'Nobody selected for this edit.'
    const profileResult = await adminUpdateEmployee(editing.id, editPayload(pick))
    const savedName = profileResult.employee?.full_name ?? editing.full_name
    if (profileResult.error) return profileResult.error.userMessage

    if (pick.is_active !== editing.is_active) {
      const statusResult = await adminSetEmployeeActive(editing.id, pick.is_active)
      if (statusResult.error) {
        return `Profile saved, but the state change failed: ${statusResult.error.userMessage}`
      }
    }

    setToast(`${savedName} updated on the roster.`, TOAST_KIND.Ok)
    reload()
    load()
    return null // dialog closes itself on success
  }

  return (
    <div className="page">
      <PageHead eyebrow="Administration · Directory" title="Roster desk." accent>
        <p>The whole company on one ledger — every employee and manager. Retune roles, retire people or move them between teams.</p>
      </PageHead>

      <RosterDesk people={people} loading={loading} onEdit={setEditing} />

      {editing && (
        <EditPersonModal
          person={editing}
          people={people}
          viewerId={profile?.id ?? null}
          onApply={apply}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
