// Domain types for the leave portal frontend.
//
// Enum values mirror the leave API; view models mirror src/store/mappings.ts.
import type { STATUSES, MODES, ROLES, TOAST_KIND } from '../constants'

/* ---------- enums (literal mirrors of the Postgres enums) ---------- */

export type RequestStatus = (typeof STATUSES)[keyof typeof STATUSES]
export type LeaveMode = (typeof MODES)[keyof typeof MODES]
export type SystemRole = (typeof ROLES)[keyof typeof ROLES]
export type ToastKind = (typeof TOAST_KIND)[keyof typeof TOAST_KIND]

// Only Approved/Rejected are decisions — the DB update guard trigger accepts
// nothing else from managers/admins.
export type RequestDecision = Extract<RequestStatus, 'Approved' | 'Rejected'>

// holidays.kind is a text column with a check constraint (schema.sql), not an enum.
export type HolidayKind = 'fixed' | 'optional'

/* ---------- service error contract (services/errors.ts) ---------- */

export interface ServiceErrorLike {
  message?: string | null
  code?: string | number | null
  status?: number
  headers?: Record<string, unknown>
}

export interface ServicedError {
  code: string | number
  context: string
  userMessage: string
  outcomeUnknown?: boolean
  status?: number
  retryAfterMs?: number
}

/* ---------- API response rows ---------- */

export interface EmployeeRow {
  id: string
  user_id: string | null
  emp_no: string
  full_name: string
  initials: string | null
  email: string
  job_title: string | null
  doj: string | null
  account: string | null
  project_name: string | null
  function_name: string | null
  manager_id: string | null
  delivery_partner_name: string | null
  location: string | null
  system_role: SystemRole
  created_at: string
}

export interface LeaveTypesRow {
  id: number
  name: string
  is_active: boolean
}

export interface LeaveRequestsRow {
  id: number
  request_no: string
  employee_id: string
  leave_type_id: number
  start_date: string
  end_date: string
  days: string | number
  mode: LeaveMode
  reason: string
  status: RequestStatus
  approver_id: string | null
  decided_at: string | null
  requested_on: string
  created_at: string
}

export interface LeaveBalancesRow {
  id: number
  employee_id: string
  year: number
  opening_annual: string | number
  annual_credited: string | number
  annual_utilized: string | number
  contingency_credited: string | number
  contingency_utilized: string | number
  annual_cap: string | number
  contingency_cap: string | number
}

export interface HolidaysRow {
  id: number
  country: string
  location: string | null
  year: number
  kind: HolidayKind
  holiday_date: string
  name: string
}

export interface OptionalHolidayPickInsert {
  employee_id: string
  holiday_id: number
}

// The joined row the leave-requests columns select:
//   leave_types!leave_requests_leave_type_id_fkey(name)
//   employees!leave_requests_employee_id_fkey(full_name, emp_no)
export type LeaveRequestSelectRow = LeaveRequestsRow & {
  leave_types?: { name: string } | null
  employees?: { full_name: string; emp_no: string } | null
}

// Profile responses include the manager name from the API.
export type EmployeeProfileRow = EmployeeRow & { manager?: { full_name: string } | null }

// The shape addMine() accepts — the leave request as composed by the form and
// applied by the store (before any DB insert mapping).
export interface LeaveRequestInput {
  type: string
  from: string
  to: string
  days: number
  mode: LeaveMode
  reason: string
  requestedOn: string
}

export type LeaveRequestUpdateInput = Omit<LeaveRequestInput, 'requestedOn'>
/* ---------- view models exposed by the store / components ---------- */

export interface LeaveRequestRow {
  id: string // request_no, e.g. 'LV-2026-00007'
  type: string
  from: string
  to: string
  days: number
  mode: LeaveMode
  reason: string
  requestedOn: string
  status: RequestStatus
}

export type TeamRequestRow = LeaveRequestRow & {
  name: string
  empId: string
  absenceType: string
}

export interface BalanceBarRow {
  key: string
  label: string
  value: number
  max: number
}

export interface BalanceSummary {
  totalCredited: number
  utilized: number
  rows: BalanceBarRow[]
}

export interface ToastModel {
  msg: string
  kind: ToastKind
  id: number
}

/* Admin persona ---------------------------------------------------------- */

export interface EmployeeAdminRow {
  id: string
  user_id: string | null
  emp_no: string
  full_name: string
  initials: string | null
  email: string
  job_title: string | null
  doj: string | null
  account: string | null
  project_name: string | null
  function_name: string | null
  manager_id: string | null
  delivery_partner_name: string | null
  location: string | null
  system_role: SystemRole
  is_active: boolean
  created_at: string | null
}

export interface EmployeeCreateInput {
  full_name: string
  email: string
  system_role: 'employee' | 'manager'
  temporary_password?: string | null
  initials?: string | null
  job_title?: string | null
  doj?: string | null
  account?: string | null
  project_name?: string | null
  function_name?: string | null
  manager_id?: string | null
  delivery_partner_name?: string | null
  location?: string | null
}

export interface EmployeeUpdateInput {
  full_name?: string
  email?: string
  initials?: string | null
  job_title?: string | null
  system_role?: 'employee' | 'manager' | 'admin'
  doj?: string | null
  account?: string | null
  project_name?: string | null
  function_name?: string | null
  manager_id?: string | null
  delivery_partner_name?: string | null
  location?: string | null
}

export interface EmployeeCreateResult {
  employee: EmployeeAdminRow
  temporary_password: string | null
}

export interface EmployeePage {
  items: EmployeeAdminRow[]
  total: number
}

export interface AuditLogRow {
  id: number
  actor_user_id: string | null
  actor_employee_id: string | null
  action: string
  target_type: string
  target_id: string | null
  detail_json: Record<string, unknown> | null
  request_ip: string | null
  created_at: string | null
}

export interface AuditLogPage {
  items: AuditLogRow[]
  total: number
}

export interface LeavePolicyConfig {
  annual_days_per_year: number
  contingency_days_per_year: number
  carry_forward_max: number
  optional_holidays_max: number
  prorated_by: string
  proration_method: string
}

export interface AdminBalanceRow {
  employee_id: string
  year: number
  opening_annual: number | string
  annual_credited: number | string
  annual_utilized: number | string
  contingency_credited: number | string
  contingency_utilized: number | string
  annual_cap: number | string
  contingency_cap: number | string
  employee: { id: string; full_name: string; emp_no: string; system_role: SystemRole }
}

export interface BalanceUpsertInput {
  annual_credited?: number | null
  contingency_credited?: number | null
  opening_annual?: number | null
  annual_cap?: number | null
  contingency_cap?: number | null
}

export interface StaleEvidence {
  window: { from: string; to: string }
  nearby_approved: Array<{
    request_no: string
    leave_type: string
    start_date: string
    end_date: string
    status: string
  }>
  holidays: Array<{ holiday_date: string; name: string; kind: string }>
}

/* Raw row from GET /admin/requests/stale (snakes_case, like the API) */
export interface StaleRequestRow {
  request_no: string
  employee_id: string
  start_date: string
  end_date: string
  days: string | number
  mode: LeaveMode
  reason: string
  status: RequestStatus
  requested_on: string
  leave_types?: { name: string } | null
  employees?: { full_name: string; emp_no: string } | null
  evidence: StaleEvidence
}

export interface PasswordResetInit {
  reset_token: string
  reset_endpoint: string
  expires_at: string
}

/* Notifications (GET /notifications) — decision notices and admin nudges */
export interface NotificationRow {
  id: number
  kind: string
  title: string
  body: string
  target_type: string | null
  target_id: string | null
  read_at: string | null
  created_at: string
}

/* POST /admin/notifications body — admin nudge to pending-decision holders */
export interface NudgeInput {
  recipient_employee_ids: string[]
  title: string
  body: string
}
