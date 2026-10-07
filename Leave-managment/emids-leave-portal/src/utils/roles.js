import { ROLES } from '../constants'

export const canApprove = (profile) => profile?.system_role === ROLES.Manager || profile?.system_role === ROLES.Admin
