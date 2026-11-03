import type { EmployeeAdminRow, SystemRole } from '../../types/models'

/** What the roster's edit dialog touches — identity fields stay put. */
export interface EditPick {
  system_role: SystemRole
  is_active: boolean
  job_title: string
  /** Empty string when the person becomes a manager (no reporting line). */
  manager_id: string
}

export interface EditIssues {
  /** A full-stop problem (e.g. manager with unsettled team) — nothing saves. */
  blocker: string | null
  /** Per-field problems, fixable inside the dialog. */
  fields: Record<string, string>
}

/** Active employees in the employee role reporting directly to this person
 * (settled-team guard input). The page fetches the person's report rows; this
 * keeps the pure filter out of JSX. */
export function activeReportsOf(id: string, people: EmployeeAdminRow[]): EmployeeAdminRow[] {
  return people.filter(
    (person) =>
      person.system_role === 'employee' && person.is_active && person.manager_id === id
  )
}

/** Per-edit data the dialog resolves from the API instead of a full directory. */
export interface EditContext {
  /** This exact person's report rows (all roles) — narrowed with activeReportsOf. */
  reports: EmployeeAdminRow[]
  /** Active manager-role candidates for the reports-to picker. */
  managers: EmployeeAdminRow[]
}

/**
 * Rules for a roster edit. Two tiers:
 * `fields` — fixable in the dialog (bad team pick, blank title).
 * `blocker` — the person cannot leave the manager role (demote or retire)
 * while their active reports hang off them; the backend enforces the same
 * rule, this only keeps the dialog honest. `viewerId` is the signed-in
 * admin — a person may never retune their own role.
 */
export function editIssues(
  pick: EditPick,
  current: EmployeeAdminRow,
  context: EditContext,
  viewerId: string | null
): EditIssues {
  const fields: Record<string, string> = {}

  if (!pick.job_title.trim()) fields.job_title = 'Job title is required'

  if (pick.system_role === 'employee') {
    const manager = context.managers.find((person) => person.id === pick.manager_id)
    if (!pick.manager_id) {
      fields.manager_id = 'Employees need a reporting manager'
    } else if (!manager || manager.system_role === 'employee') {
      fields.manager_id = 'Pick someone in the manager role'
    } else if (!manager.is_active) {
      fields.manager_id = 'That manager is not active'
    } else if (manager.id === current.id) {
      fields.manager_id = 'Nobody reports to themselves'
    }
  }

  if (viewerId && current.id === viewerId && pick.system_role !== current.system_role) {
    fields.system_role = 'You cannot change your own role'
  }

  const losingTeam =
    (current.system_role === 'manager' || current.system_role === 'admin') &&
    (pick.system_role === 'employee' || !pick.is_active)
  let blocker: string | null = null
  if (losingTeam) {
    const reports = activeReportsOf(current.id, context.reports)
    if (reports.length > 0) {
      blocker =
        `${current.full_name} still has ${reports.length} active direct ` +
        `reports — reassign or retire them first.`
    }
  }

  return { blocker, fields }
}

/** The PUT payload the pick projects to (identity fields are never rewritten). */
export function editPayload(pick: EditPick): {
  system_role: SystemRole
  job_title: string
  manager_id: string | null
} {
  return {
    system_role: pick.system_role,
    job_title: pick.job_title.trim(),
    manager_id: pick.system_role === 'employee' ? pick.manager_id : null,
  }
}
