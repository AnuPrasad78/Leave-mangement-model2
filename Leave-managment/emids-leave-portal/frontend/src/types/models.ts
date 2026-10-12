// Domain types for the leave portal frontend.
//
// Everything here is derived from existing sources only:
// - enum/unions mirror src/constants.js, which mirrors the Postgres enums in
//   backend/supabase/schema.sql (pinned by tests/unit/constants.test.js)
// - row shapes mirror backend/supabase/schema.sql via src/types/database.ts
// - view models mirror the mappers in src/store/mappings.js
import type { STATUSES, MODES, ROLES, TOAST_KIND } from '../constants'
import type { Database } from './database'

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

// Supabase PostgREST/Auth error shape actually observed by normalizeSupabaseError.
export interface SupabaseErrorLike {
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

/* ---------- DB rows (aliases into the Database shape) ---------- */

export type EmployeeRow = Database['public']['Tables']['employees']['Row']
export type LeaveTypesRow = Database['public']['Tables']['leave_types']['Row']
export type LeaveRequestsRow = Database['public']['Tables']['leave_requests']['Row']
export type LeaveRequestsInsert = Database['public']['Tables']['leave_requests']['Insert']
export type LeaveRequestsUpdate = Database['public']['Tables']['leave_requests']['Update']
export type LeaveBalancesRow = Database['public']['Tables']['leave_balances']['Row']
export type HolidaysRow = Database['public']['Tables']['holidays']['Row']
export type OptionalHolidayPickInsert = Database['public']['Tables']['optional_holiday_picks']['Insert']
export type SeparationRequestsInsert = Database['public']['Tables']['separation_requests']['Insert']

// The joined row the leave-requests columns select:
//   leave_types!leave_requests_leave_type_id_fkey(name)
//   employees!leave_requests_employee_id_fkey(full_name, emp_no)
export type LeaveRequestSelectRow = LeaveRequestsRow & {
  leave_types?: { name: string } | null
  employees?: { full_name: string; emp_no: string } | null
}

// fetchProfileByAuthId enriches the employees row with a same-table embed.
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
