import { ROLES } from '../constants'
import type { EmployeeRow } from '../types/models'

export const canApprove = (profile: Pick<EmployeeRow, 'system_role'> | null | undefined): boolean =>
  profile?.system_role === ROLES.Manager || profile?.system_role === ROLES.Admin
