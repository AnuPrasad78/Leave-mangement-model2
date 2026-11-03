import { describe, expect, it } from 'vitest'
import { activeReportsOf, editIssues, editPayload, type EditContext, type EditPick } from '../../../../src/features/admin/editEmployee'
import type { EmployeeAdminRow } from '../../../../src/types/models'

const person = (over: Partial<EmployeeAdminRow>): EmployeeAdminRow => ({
  id: 'e-x',
  user_id: 'u-x',
  emp_no: 'EM-32222',
  full_name: 'Ada Lovelace',
  initials: 'AL',
  email: 'ada.lovelace@emids.com',
  job_title: 'Engineer',
  doj: '2024-01-10',
  account: null,
  project_name: null,
  function_name: null,
  manager_id: 'e-m2',
  delivery_partner_name: null,
  location: null,
  system_role: 'employee',
  is_active: true,
  created_at: '2024-01-10T00:00:00Z',
  ...over,
})

// e-m2 carries two ACTIVE reports and one inactive one — the guard counts
// only the active pair.
const team: EmployeeAdminRow[] = [
  person({ id: 'e-m1', system_role: 'manager', manager_id: null, emp_no: 'EM-30201' }),
  person({ id: 'e-m2', system_role: 'manager', manager_id: null, emp_no: 'EM-30202' }),
  person({ id: 'e-m3', system_role: 'manager', is_active: false, manager_id: null, emp_no: 'EM-30203' }),
  person({ id: 'e-e1', manager_id: 'e-m2', emp_no: 'EM-30211' }),
  person({ id: 'e-e2', manager_id: 'e-m2', emp_no: 'EM-30212' }),
  person({ id: 'e-e3', is_active: false, manager_id: 'e-m2', emp_no: 'EM-30213' }),
]

describe('activeReportsOf', () => {
  it('counts only active employees reporting directly', () => {
    expect(activeReportsOf('e-m2', team).map((u) => u.id)).toEqual(['e-e1', 'e-e2'])
    expect(activeReportsOf('e-m1', team)).toEqual([])
  })
})

// Per-edit data now arrives as a context object: the team fixture plays both
// roles — its employee rows feed the settled-team guard, its manager rows
// (active and inactive alike) feed the reports-to picker checks.
const context = (): EditContext => ({
  reports: team,
  managers: team.filter((p) => p.system_role === 'manager'),
})

describe('editIssues', () => {
  const clean: EditPick = {
    system_role: 'employee',
    is_active: true,
    job_title: 'Senior Engineer',
    manager_id: 'e-m1',
  }

  it('passes a quiet job-title retune', () => {
    const found = editIssues({ ...clean, manager_id: 'e-m2' }, team[4]!, context(), 'e-admin')
    expect(found.blocker).toBeNull()
    expect(found.fields).toEqual({})
  })

  it('demands a reporting manager for employees', () => {
    const found = editIssues({ ...clean, manager_id: '' }, team[4]!, context(), null)
    expect(found.fields.manager_id).toBeTruthy()
  })

  it('rejects an unknown, inactive or self reporting manager', () => {
    expect(editIssues({ ...clean, manager_id: 'e-nope' }, team[4]!, context(), null).fields.manager_id).toBeTruthy()
    expect(editIssues({ ...clean, manager_id: 'e-m3' }, team[4]!, context(), null).fields.manager_id).toBeTruthy()
    expect(editIssues({ ...clean, manager_id: 'e-x' }, team[4]!, context(), null).fields.manager_id).toBeTruthy()
  })

  it('requires a job title', () => {
    const found = editIssues({ ...clean, job_title: '  ', manager_id: 'e-m2' }, team[4]!, context(), null)
    expect(found.fields.job_title).toBeTruthy()
  })

  it('refuses the signed-in admin retuning their own role', () => {
    const found = editIssues(
      { ...clean, system_role: 'manager' },
      team[4]!,
      context(),
      team[4]!.id
    )
    expect(found.fields.system_role).toBeTruthy()
    expect(editIssues({ ...clean }, team[4]!, context(), team[4]!.id).fields.system_role).toBeUndefined()
  })

  it('blocks inactivating a manager with active reports', () => {
    const found = editIssues(
      { ...clean, system_role: 'manager', is_active: false, manager_id: '' },
      team[1]!,
      context(),
      null
    )
    expect(found.blocker).toMatch(/2 active direct reports/)
  })

  it('blocks demoting a manager with active reports', () => {
    const found = editIssues(
      { ...clean, system_role: 'employee', job_title: 'QA Lead', manager_id: 'e-m1' },
      team[1]!,
      context(),
      null
    )
    expect(found.blocker).toMatch(/2 active direct reports/)
  })

  it('lets a settled manager step away', () => {
    const found = editIssues(
      { ...clean, system_role: 'manager', is_active: false, manager_id: '' },
      team[2]!, // e-m3 has no active reports: inactivation is a clean move
      context(),
      null
    )
    expect(found.blocker).toBeNull()
    expect(found.fields).toEqual({})
  })

  it('projects the put payload and clears the reporting line for managers', () => {
    const payload = editPayload({ ...clean, system_role: 'manager', job_title: ' QA Manager ', manager_id: 'e-e1' })
    expect(payload).toEqual({ system_role: 'manager', job_title: 'QA Manager', manager_id: null })

    const employeePayload = editPayload(clean)
    expect(employeePayload).toEqual({ system_role: 'employee', job_title: 'Senior Engineer', manager_id: 'e-m1' })
  })
})
