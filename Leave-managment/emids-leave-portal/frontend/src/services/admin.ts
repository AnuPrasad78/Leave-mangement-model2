import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type {
  AuditLogPage,
  BalanceUpsertInput,
  EmployeeCreateInput,
  EmployeeCreateResult,
  EmployeePage,
  EmployeeUpdateInput,
  LeavePolicyConfig,
  AdminBalanceRow,
  LeaveRequestSelectRow,
  NudgeInput,
  PasswordResetInit,
  ServicedError,
  StaleRequestRow,
} from '../types/models'

export async function fetchAdminEmployees(search = ''): Promise<{ page: EmployeePage; error: ServicedError | null }> {
  return withServiceErrors(
    'admin employee lookup',
    async () => {
      const params = new URLSearchParams({ limit: '200' })
      if (search) params.set('search', search)
      const page = await apiRequest<EmployeePage>(`/admin/employees?${params}`)
      return { page, error: null }
    },
    (error) => ({ page: { items: [], total: 0 }, error }),
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
  year: number
): Promise<{ rows: AdminBalanceRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'admin balances lookup',
    async () => {
      const page = await apiRequest<{ items: AdminBalanceRow[] }>(`/admin/leave-balances?year=${year}`)
      return { rows: page.items, error: null }
    },
    (error) => ({ rows: [], error }),
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
  filters: { action?: string; date_from?: string; date_to?: string; limit?: number }
): Promise<{ page: AuditLogPage; error: ServicedError | null }> {
  return withServiceErrors(
    'audit logs lookup',
    async () => {
      const params = new URLSearchParams()
      if (filters.action) params.set('action', filters.action)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      params.set('limit', String(filters.limit ?? 200))
      const page = await apiRequest<AuditLogPage>(`/admin/audit-logs?${params}`)
      return { page, error: null }
    },
    (error) => ({ page: { items: [], total: 0 }, error }),
    true
  )
}

export async function fetchStaleRequests(
  before: string
): Promise<{ rows: StaleRequestRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'stale request lookup',
    async () => {
      const rows = await apiRequest<StaleRequestRow[]>(`/admin/requests/stale?before=${before}`)
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchOrgRequests(): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'org request lookup',
    async () => {
      const rows = await apiRequest<LeaveRequestSelectRow[]>('/leave-requests/team?limit=0')
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
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
