import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, subscribeToAuth, signInWithPassword, signOut as signOutClient } from '../services/auth'
import { fetchProfileByAuthId, fetchReportIds } from '../services/employees'
import { fetchLatestBalances } from '../services/balances'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../services/leaveTypes'
import { fetchMine, fetchTeam, insertMine, cancelMine, decide, decideMany } from '../services/leaveRequests'
import { mapRow, mapTeamRow, toBalances } from './mappings'
import { TOAST_KIND, STATUSES } from '../constants'
import type {
  BalanceSummary,
  EmployeeProfileRow,
  LeaveRequestInput,
  LeaveRequestRow,
  RequestDecision,
  ServicedError,
  TeamRequestRow,
  ToastKind,
  ToastModel,
} from '../types/models'

export interface AuthContextValue {
  signedIn: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<boolean>
  profile: EmployeeProfileRow | null
  mine: LeaveRequestRow[]
  team: TeamRequestRow[]
  balances: BalanceSummary | null
  leaveTypes: string[]
  authReady: boolean
  addMine: (input: LeaveRequestInput) => Promise<string | null>
  decide: (id: string, decision: RequestDecision) => Promise<void>
  decideMany: (ids: string[], decision: RequestDecision) => Promise<void>
  cancelMine: (id: string) => Promise<void>
  toast: ToastModel | null
  setToast: (msg: string, kind?: ToastKind) => void
  CURRENT_YEAR: number
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const CURRENT_YEAR = new Date().getFullYear()
const unexpectedMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authReady, setAuthReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [profile, setProfile] = useState<EmployeeProfileRow | null>(null)
  const [mine, setMine] = useState<LeaveRequestRow[]>([])
  const [team, setTeam] = useState<TeamRequestRow[]>([])
  const [balances, setBalances] = useState<BalanceSummary | null>(null)
  const [leaveTypes, setLeaveTypes] = useState<string[]>([])
  const [toast, setToastState] = useState<ToastModel | null>(null)
  const meRef = useRef<{ uid: string; id: string | null } | null>(null) // id = employees.id
  const toastTimer = useRef<number | null>(null)

  const setToast = useCallback((msg: string, kind: ToastKind = TOAST_KIND.Ok) => {
    setToastState({ msg, kind, id: Date.now() })
    window.clearTimeout(toastTimer.current ?? undefined)
    toastTimer.current = window.setTimeout(() => setToastState(null), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current ?? undefined), [])

  const loadMine = useCallback(
    async (meId: string) => {
      const { rows, error } = await fetchMine(meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setMine(rows.map(mapRow))
    },
    [setToast]
  )

  const loadTeam = useCallback(
    async (meId: string) => {
      const { ids, error: reportError } = await fetchReportIds(meId)
      if (reportError) {
        setToast(reportError.userMessage, TOAST_KIND.Error)
        setTeam([])
        return
      }
      if (!ids.length) {
        setTeam([])
        return
      }
      const { rows, error } = await fetchTeam(ids)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        setTeam([])
        return
      }
      setTeam(rows.map(mapTeamRow))
    },
    [setToast]
  )

  const loadBalances = useCallback(
    async (meId: string) => {
      const { row, error } = await fetchLatestBalances(meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setBalances(toBalances(row))
    },
    [setToast]
  )

  const loadLeaveTypes = useCallback(
    async () => {
      const { names, error } = await fetchActiveLeaveTypeNames()
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setLeaveTypes(names)
    },
    [setToast]
  )

  const handleSession = useCallback(
    async (session: Session | null) => {
      const user = session?.user
      if (!user) {
        meRef.current = null
        setSignedIn(false)
        setProfile(null)
        setMine([])
        setTeam([])
        setBalances(null)
        return
      }
      if (!meRef.current || meRef.current.uid !== user.id) {
        meRef.current = { uid: user.id, id: null }
        const { profile: p, error, warning } = await fetchProfileByAuthId(user.id)
        if (meRef.current?.uid !== user.id) return
        meRef.current.id = p?.id ?? null
        setProfile(p ?? null)
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        else {
          if (warning) setToast(warning.userMessage, TOAST_KIND.Error)
          const results = await Promise.allSettled([loadMine(p.id), loadTeam(p.id), loadBalances(p.id), loadLeaveTypes()])
          results.forEach((result) => {
            if (result.status === 'rejected') setToast(unexpectedMessage(result.reason), TOAST_KIND.Error)
          })
        }
      }
      setSignedIn(true)
    },
    [loadMine, loadTeam, loadBalances, loadLeaveTypes, setToast]
  )

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const { session } = await getSession()
        if (mounted) await handleSession(session)
      } catch (error) {
        if (mounted) {
          setSignedIn(false)
          setToast(unexpectedMessage(error), TOAST_KIND.Error)
        }
      } finally {
        if (mounted) setAuthReady(true)
      }
    }
    void init()
    const subscription = subscribeToAuth((event, session) => {
      if (event === 'SIGNED_OUT') {
        meRef.current = null
        setSignedIn(false)
        setProfile(null)
        setMine([])
        setTeam([])
        setBalances(null)
        setLeaveTypes([])
      } else {
        void handleSession(session).catch((error: unknown) => {
          setToast(unexpectedMessage(error), TOAST_KIND.Error)
        }).finally(() => setAuthReady(true))
      }
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [handleSession, setToast])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await signInWithPassword(email, password)
      return error ? error.message : null
    } catch (error) {
      return unexpectedMessage(error)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const { error } = await signOutClient()
      if (error) {
        setToast(error.message || 'Unable to sign out. Please try again.', TOAST_KIND.Error)
        return false
      }
      return true
    } catch (error) {
      setToast(unexpectedMessage(error), TOAST_KIND.Error)
      return false
    }
  }, [setToast])

  const addMine = useCallback(
    async ({ type, from, to, days, mode, reason, requestedOn }: LeaveRequestInput) => {
      const meId = meRef.current?.id
      if (!meId) return null
      const { id: leaveTypeId, error: typeError } = await fetchLeaveTypeIdByName(type)
      if (typeError) {
        setToast(typeError.userMessage, TOAST_KIND.Error)
        return null
      }
      if (!leaveTypeId) {
        setToast(`Unknown leave type: ${type}`, TOAST_KIND.Error)
        return null
      }
      const { requestNo, error } = await insertMine({
        employee_id: meId,
        leave_type_id: leaveTypeId,
        start_date: from,
        end_date: to,
        days,
        mode,
        reason: reason || '(no reason given)',
        requested_on: requestedOn,
      })
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        if (error.outcomeUnknown) {
          const uncertain = new Error(error.userMessage)
          uncertain.name = 'OutcomeUnknownError'
          throw uncertain
        }
        return null
      }
      await loadMine(meId)
      return requestNo
    },
    [loadMine, setToast]
  )

  const cancelRequest = useCallback(
    async (id: string) => {
      const meId = meRef.current?.id
      if (!meId) return
      const { error } = await cancelMine(id, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else setToast('Request cancelled', TOAST_KIND.Ok)
      await loadMine(meId)
      await loadBalances(meId)
    },
    [loadMine, loadBalances, setToast]
  )

  const approveRequest = useCallback(
    async (id: string, decision: RequestDecision) => {
      const meId = meRef.current?.id
      if (!meId) return
      const { error } = await decide(id, decision, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else
        setToast(
          decision === STATUSES.Approved ? 'Request approved' : 'Request rejected',
          decision === STATUSES.Approved ? TOAST_KIND.Ok : TOAST_KIND.Error
        )
      await loadTeam(meId)
    },
    [loadTeam, setToast]
  )

  const approveRequests = useCallback(
    async (ids: string[], decision: RequestDecision) => {
      const meId = meRef.current?.id
      if (!meId || !ids.length) return
      const { error } = await decideMany(ids, decision, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else if (decision === STATUSES.Approved) setToast(`${ids.length} requests approved`, TOAST_KIND.Ok)
      else setToast(`${ids.length} requests rejected`, TOAST_KIND.Error)
      await loadTeam(meId)
    },
    [loadTeam, setToast]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      signedIn, signIn, signOut,
      profile, mine, team, balances, leaveTypes, authReady,
      addMine, decide: approveRequest, decideMany: approveRequests, cancelMine: cancelRequest, toast, setToast,
      CURRENT_YEAR,
    }),
    [signedIn, signIn, signOut, profile, mine, team, balances, leaveTypes, authReady, addMine, approveRequest, approveRequests, cancelRequest, toast, setToast]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Non-null by contract: every consumer renders under AuthProvider in main.tsx,
// and tests provide their own provider; original JS destructured the same way.
export const useAuth = (): AuthContextValue => useContext(AuthContext) as AuthContextValue

// Re-exported for consumers that need to inspect the shape (poked by tests).
export type { ServicedError }
