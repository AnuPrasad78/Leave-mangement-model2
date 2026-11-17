import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type {
  AdminBalanceRow,
  AuditLogRow,
  BalanceUpsertInput,
  EmployeeAdminRow,
  EmployeeCreateInput,
  EmployeeCreateResult,
  EmployeeUpdateInput,
  LeavePolicyConfig,
  LeaveRequestSelectRow,
  NudgeInput,
  Paginated,
  PasswordResetInit,
  ServicedError,
  StaleRequestRow,
} from '../types/models'

/* List-board call contracts now page from the server:
   /admin/employees?page=2&page_size=10[&search=&role=&active=&manager_id=&sort=&order=] */

export interface EmployeeLookup {
  search?: string
  role?: 'employee' | 'manager' | 'admin'
  active?: boolean
  managerId?: string
  sort?: 'full_name' | 'doj' | 'emp_no'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

function pageQuery(page: number, pageSize = 10): URLSearchParams {
  return new URLSearchParams({ page: String(page), page_size: String(pageSize) })
}

const DEFAULT_PAGED = { rows: [], page: 0, page_size: 0, total: 0, page_count: 0 } as const

export async function fetchAdminEmployees(
  input: EmployeeLookup = {}
): Promise<{ page: Paginated<EmployeeAdminRow>; error: ServicedError | null }> {
  return withServiceErrors(
    'admin employee lookup',
    async () => {
      const params = pageQuery(input.page ?? 1, input.pageSize ?? 10)
      if (input.search) params.set('search', input.search)
      if (input.role) params.set('role', input.role)
      if (input.active !== undefined) params.set('active', String(input.active))
      if (input.managerId) params.set('manager_id', input.managerId)
      if (input.sort) params.set('sort', input.sort)
      if (input.order) params.set('order', input.order)
      const page = await apiRequest<Paginated<EmployeeAdminRow>>(`/admin/employees?${params}`)
      return { page, error: null }
    },
    (error) => ({ page: { rows: [], page: 0, page_size: 0, total: 0, page_count: 0 }, error }),
    true
  )
}

export async function adminCreateEmployee(
  input: EmployeeCreateInput
): Promise<{ result: EmployeeCreateResult | null; error: ServicedError | null }> {
  return withServiceErrors(
    'create employee',
    async () => {
      const result = await apiRequest<EmployeeCreateResult>('/admin/employees', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return { result, error: null }
    },
    (error) => ({ result: null, error })
  )
}

export async function adminUpdateEmployee(
  id: string,
  input: EmployeeUpdateInput
): Promise<{ employee: EmployeeCreateResult['employee'] | null; error: ServicedError | null }> {
  return withServiceErrors(
    'update employee',
    async () => {
      const employee = await apiRequest<EmployeeCreateResult['employee']>(`/admin/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
      return { employee, error: null }
    },
    (error) => ({ employee: null, error }),
    false,
    true
  )
}

export async function adminSetEmployeeActive(
  id: string,
  active: boolean
): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    active ? 'activate employee' : 'deactivate employee',
    async () => {
      await apiRequest<{ ok: boolean }>(`/admin/employees/${id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function adminInitPasswordReset(
  userId: string
): Promise<{ init: PasswordResetInit | null; error: ServicedError | null }> {
  return withServiceErrors(
    'password reset initialization',
    async () => {
      const init = await apiRequest<PasswordResetInit>(`/admin/employee-password-resets/${userId}/init`, {
        method: 'POST',
      })
      return { init, error: null }
    },
    (error) => ({ init: null, error }),
    false,
    true
  )
}

export async function fetchLeavePolicies(): Promise<{ config: LeavePolicyConfig | null; error: ServicedError | null }> {
  return withServiceErrors(
    'leave policies lookup',
    async () => {
      const config = await apiRequest<LeavePolicyConfig>('/admin/leave-policies')
      return { config, error: null }
    },
    (error) => ({ config: null, error }),
    true
  )
}

export async function fetchAdminBalances(
  year: number,
  page = 1
): Promise<{ page: Paginated<AdminBalanceRow> & { year: number }; error: ServicedError | null }> {
  return withServiceErrors(
    'admin balances lookup',
    async () => {
      const result = await apiRequest<Paginated<AdminBalanceRow> & { year: number }>(
        `/admin/leave-balances?${pageQuery(page)}&year=${year}`
      )
      return { page: result, error: null }
    },
    (error) => ({ page: { rows: [], page: 0, page_size: 0, total: 0, page_count: 0, year }, error }),
    true
  )
}

export async function adminUpsertBalance(
  employeeId: string,
  year: number,
  input: BalanceUpsertInput
): Promise<{ row: AdminBalanceRow | null; error: ServicedError | null }> {
  return withServiceErrors(
    'balance correction',
    async () => {
      const row = await apiRequest<AdminBalanceRow>(`/admin/leave-balances/${employeeId}/${year}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
      return { row, error: null }
    },
    (error) => ({ row: null, error }),
    false,
    true
  )
}

export async function fetchAuditLogs(
  filters: { action?: string; date_from?: string; date_to?: string },
  page = 1
): Promise<{ page: Paginated<AuditLogRow>; error: ServicedError | null }> {
  return withServiceErrors(
    'audit logs lookup',
    async () => {
      const params = pageQuery(page)
      if (filters.action) params.set('action', filters.action)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      const paged = await apiRequest<Paginated<AuditLogRow>>(`/admin/audit-logs?${params}`)
      return { page: paged, error: null }
    },
    (error) => ({ page: { ...DEFAULT_PAGED, rows: [] }, error }),
    true
  )
}

export async function fetchStaleRequests(
  before: string,
  page = 1
): Promise<{ page: Paginated<StaleRequestRow>; error: ServicedError | null }> {
  return withServiceErrors(
    'stale request lookup',
    async () => {
      const paged = await apiRequest<Paginated<StaleRequestRow>>(
        `/admin/requests/stale?${pageQuery(page)}&before=${before}`
      )
      return { page: paged, error: null }
    },
    (error) => ({ page: { ...DEFAULT_PAGED, rows: [] }, error }),
    true
  )
}

/** The by-manager aggregate over the org's pending requests — a full read,
 * not paged: reminders group and count every pending request at once. */
export async function fetchOrgRequests(): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'org request lookup',
    async () => {
      const rows = await apiRequest<LeaveRequestSelectRow[]>('/leave-requests/team?status=Pending')
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

/** The "every pending request" board — one paged slice of the org queue. */
export async function fetchPendingRequestsPage(
  page = 1
): Promise<{ page: Paginated<LeaveRequestSelectRow>; error: ServicedError | null }> {
  return withServiceErrors(
    'pending requests lookup',
    async () => {
      const paged = await apiRequest<Paginated<LeaveRequestSelectRow>>(
        `/leave-requests/team?${pageQuery(page)}&status=Pending`
      )
      return { page: paged, error: null }
    },
    (error) => ({ page: { ...DEFAULT_PAGED, rows: [] }, error }),
    true
  )
}

export async function adminSendNudge(
  input: NudgeInput
): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'send nudge',
    async () => {
      await apiRequest<{ ok: boolean; recipients: number }>('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function adminCarryForward(
  year: number
): Promise<{ summary: { ok: boolean; source_year: number; target_year: number; employees: number } | null; error: ServicedError | null }> {
  return withServiceErrors(
    'carry-forward run',
    async () => {
      const summary = await apiRequest<{ ok: boolean; source_year: number; target_year: number; employees: number }>(
        '/admin/leave-requests/carry-forward',
        { method: 'POST', body: JSON.stringify({ year }) }
      )
      return { summary, error: null }
    },
    (error) => ({ summary: null, error }),
    false,
    true
  )
}
