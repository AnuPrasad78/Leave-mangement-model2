import { ROLES } from '../constants'

// Accepts any row-like shape with an optional system_role — pure feature rules
// (notifications, search) call this with partial profiles mid-load.
export const canApprove = (
  profile: { system_role?: string | null } | null | undefined
): boolean =>
  profile?.system_role === ROLES.Manager || profile?.system_role === ROLES.Admin
