import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ApiSession } from '../services/auth'
import { getSession, subscribeToAuth, signInWithPassword, signOut as signOutClient } from '../services/auth'
import { fetchProfileByAuthId, fetchReportIds } from '../services/employees'
import { fetchLatestBalances } from '../services/balances'
import { fetchActiveLeaveTypeNames } from '../services/leaveTypes'
import { fetchAllHolidays } from '../services/holidays'
import { fetchMine, fetchTeam, insertMine, updateMine as updateLeaveRequest, cancelMine, decide, decideMany } from '../services/leaveRequests'
import { mapRow, mapTeamRow, toBalances } from './mappings'
import { TOAST_KIND, STATUSES } from '../constants'
import type {
  BalanceSummary,
  EmployeeProfileRow,
  HolidaysRow,
  LeaveRequestInput,
  LeaveRequestRow,
  LeaveRequestUpdateInput,
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
  fixedHolidayDates: string[]
  authReady: boolean
  addMine: (input: LeaveRequestInput) => Promise<string | null>
  updateMine: (id: string, input: LeaveRequestUpdateInput) => Promise<boolean>
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
  const [fixedHolidayDates, setFixedHolidayDates] = useState<string[]>([])
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

  const loadFixedHolidayDates = useCallback(
    async (location: string | null, userId: string) => {
      const { rows, error } = await fetchAllHolidays()
      if (meRef.current?.uid !== userId) return
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      const city = (location ?? '').split(',')[0].trim().toLowerCase()
      setFixedHolidayDates(
        rows
          .filter(
            (holiday: HolidaysRow) =>
              Boolean(city) &&
              holiday.country === 'India' &&
              holiday.kind === 'fixed' &&
              holiday.location?.trim().toLowerCase() === city
          )
          .map((holiday) => holiday.holiday_date)
      )
    },
    [setToast]
  )

  const handleSession = useCallback(
    async (session: ApiSession | null) => {
      const user = session?.user
      if (!user) {
        meRef.current = null
        setSignedIn(false)
        setProfile(null)
        setMine([])
        setTeam([])
        setBalances(null)
        setFixedHolidayDates([])
        return
      }
      if (!meRef.current || meRef.current.uid !== user.id) {
        meRef.current = { uid: user.id, id: null }
        setFixedHolidayDates([])
        const { profile: p, error, warning } = await fetchProfileByAuthId(user.id)
        if (meRef.current?.uid !== user.id) return
        meRef.current.id = p?.id ?? null
        setProfile(p ?? null)
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        else {
          if (warning) setToast(warning.userMessage, TOAST_KIND.Error)
          const results = await Promise.allSettled([
            loadMine(p.id),
            loadTeam(p.id),
            loadBalances(p.id),
            loadLeaveTypes(),
            loadFixedHolidayDates(p.location, user.id),
          ])
          results.forEach((result) => {
            if (result.status === 'rejected') setToast(unexpectedMessage(result.reason), TOAST_KIND.Error)
          })
        }
      }
      setSignedIn(true)
    },
    [loadMine, loadTeam, loadBalances, loadLeaveTypes, loadFixedHolidayDates, setToast]
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
        setFixedHolidayDates([])
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
      const { requestNo, error } = await insertMine({
        type,
        from,
        to,
        days,
        mode,
        reason: reason || '(no reason given)',
        requestedOn,
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

  const updateRequest = useCallback(
    async (id: string, input: LeaveRequestUpdateInput) => {
      const meId = meRef.current?.id
      if (!meId) return false
      const { error } = await updateLeaveRequest(id, input)
      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
        return false
      }
      await loadMine(meId)
      return true
    },
    [loadMine, setToast]
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
      profile, mine, team, balances, leaveTypes, fixedHolidayDates, authReady,
      addMine, updateMine: updateRequest, decide: approveRequest, decideMany: approveRequests, cancelMine: cancelRequest, toast, setToast,
      CURRENT_YEAR,
    }),
    [signedIn, signIn, signOut, profile, mine, team, balances, leaveTypes, fixedHolidayDates, authReady, addMine, updateRequest, approveRequest, approveRequests, cancelRequest, toast, setToast]
  )
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Non-null by contract: every consumer renders under AuthProvider in main.tsx,
// and tests provide their own provider; original JS destructured the same way.
export const useAuth = (): AuthContextValue => useContext(AuthContext) as AuthContextValue

// Re-exported for consumers that need to inspect the shape (poked by tests).
export type { ServicedError }
