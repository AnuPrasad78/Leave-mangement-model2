import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProfileByAuthId, fetchReportIds } from '../services/employees'
import { fetchLatestBalances } from '../services/balances'
import { fetchActiveLeaveTypeNames, fetchLeaveTypeIdByName } from '../services/leaveTypes'
import { fetchMine, fetchTeam, insertMine, cancelMine, decide, decideMany } from '../services/leaveRequests'
import { mapRow, mapTeamRow, toBalances } from './mappings'
import { TOAST_KIND } from '../constants'

export const AuthContext = createContext(null)

const CURRENT_YEAR = new Date().getFullYear()

export function AuthProvider({ children }) {
  const [authReady, setAuthReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [profile, setProfile] = useState(null)
  const [mine, setMine] = useState([])
  const [team, setTeam] = useState([])
  const [balances, setBalances] = useState(null)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [toast, setToastState] = useState(null)
  const meRef = useRef(null) // { uid, id } — id = employees.id
  const toastTimer = useRef(null)

  const setToast = useCallback((msg, kind = TOAST_KIND.Ok) => {
    setToastState({ msg, kind, id: Date.now() })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastState(null), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const loadMine = useCallback(
    async (meId) => {
      const { rows, error } = await fetchMine(meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      setMine(rows.map(mapRow))
    },
    [setToast]
  )

  const loadTeam = useCallback(
    async (meId) => {
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
    async (meId) => {
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
    async (session) => {
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
        meRef.current = { uid: user.id }
        const { profile: p, error } = await fetchProfileByAuthId(user.id)
        meRef.current.id = p?.id ?? null
        setProfile(p ?? null)
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        else await Promise.all([loadMine(p?.id), loadTeam(p?.id), loadBalances(p?.id), loadLeaveTypes()])
      }
      setSignedIn(true)
    },
    [loadMine, loadTeam, loadBalances, loadLeaveTypes, setToast]
  )

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        await handleSession(session)
        setAuthReady(true)
      }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        meRef.current = null
        setSignedIn(false)
        setProfile(null)
        setMine([])
        setTeam([])
        setBalances(null)
        setLeaveTypes([])
      } else {
        handleSession(session)
      }
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [handleSession])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const addMine = useCallback(
    async ({ type, from, to, days, mode, reason, requestedOn }) => {
      const meId = meRef.current?.id
      if (!meId) return null
      const { id: leaveTypeId } = await fetchLeaveTypeIdByName(type)
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
        return null
      }
      await loadMine(meId)
      return requestNo
    },
    [loadMine, setToast]
  )

  const cancelRequest = useCallback(
    async (id) => {
      const meId = meRef.current?.id
      if (!meId) return
      const { error } = await cancelMine(id, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else setToast('Request cancelled', TOAST_KIND.Error)
      await loadMine(meId)
      await loadBalances(meId)
    },
    [loadMine, loadBalances, setToast]
  )

  const approveRequest = useCallback(
    async (id, decision) => {
      const meId = meRef.current?.id
      if (!meId) return
      const { error } = await decide(id, decision, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else setToast(decision === 'Approved' ? 'Request approved' : 'Request rejected', decision === 'Approved' ? TOAST_KIND.Ok : TOAST_KIND.Error)
      await loadTeam(meId)
    },
    [loadTeam, setToast]
  )

  const approveRequests = useCallback(
    async (ids, decision) => {
      const meId = meRef.current?.id
      if (!meId || !ids.length) return
      const { error } = await decideMany(ids, decision, meId)
      if (error) setToast(error.userMessage, TOAST_KIND.Error)
      else if (decision === 'Approved') setToast(`${ids.length} requests approved`, TOAST_KIND.Ok)
      else setToast(`${ids.length} requests rejected`, TOAST_KIND.Error)
      await loadTeam(meId)
    },
    [loadTeam, setToast]
  )

  const value = useMemo(
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

export const useAuth = () => useContext(AuthContext)
