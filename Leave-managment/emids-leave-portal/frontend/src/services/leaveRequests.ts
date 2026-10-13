import { apiRequest } from './apiClient'
import { withServiceErrors } from './errors'
import type { LeaveRequestInput, LeaveRequestSelectRow, RequestDecision, ServicedError } from '../types/models'

export async function fetchMine(_employeeId: string): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'my requests',
    async () => {
      const rows = await apiRequest<LeaveRequestSelectRow[]>('/leave-requests/mine')
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function fetchTeam(_employeeIds: string[]): Promise<{ rows: LeaveRequestSelectRow[]; error: ServicedError | null }> {
  return withServiceErrors(
    'team requests',
    async () => {
      const rows = await apiRequest<LeaveRequestSelectRow[]>('/leave-requests/team')
      return { rows, error: null }
    },
    (error) => ({ rows: [], error }),
    true
  )
}

export async function insertMine(payload: LeaveRequestInput): Promise<{ requestNo: string | null; error: ServicedError | null }> {
  return withServiceErrors(
    'submit request',
    async () => {
      const data = await apiRequest<{ requestNo: string }>('/leave-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return { requestNo: data.requestNo, error: null }
    },
    (error) => ({ requestNo: null, error }),
    false,
    true
  )
}

export async function cancelMine(requestNo: string, _employeeId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'cancel request',
    async () => {
      await apiRequest(`/leave-requests/${encodeURIComponent(requestNo)}/cancel`, { method: 'POST' })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function decide(requestNo: string, decision: RequestDecision, _approverId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'decision',
    async () => {
      await apiRequest(`/leave-requests/${encodeURIComponent(requestNo)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}

export async function decideMany(requestNos: string[], decision: RequestDecision, _approverId: string): Promise<{ error: ServicedError | null }> {
  return withServiceErrors(
    'bulk decision',
    async () => {
      await apiRequest('/leave-requests/bulk-decision', {
        method: 'POST',
        body: JSON.stringify({ request_nos: requestNos, decision }),
      })
      return { error: null }
    },
    (error) => ({ error }),
    false,
    true
  )
}
