import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const CURRENT_YEAR = new Date().getFullYear()

const REQUEST_FIELDS =
  'request_no, employee_id, start_date, end_date, days, mode, reason, status, requested_on, ' +
  'leave_types!leave_requests_leave_type_id_fkey(name), ' +
  'employees!leave_requests_employee_id_fkey(full_name, emp_no)'

const mapRow = (r) => ({
  id: r.request_no,
  type: r.leave_types?.name ?? '',
  from: r.start_date,
  to: r.end_date,
  days: Number(r.days),
  mode: r.mode,
  reason: r.reason,
  requestedOn: r.requested_on,
  status: r.status,
})

const mapTeamRow = (r) => ({
  ...mapRow(r),
  name: r.employees?.full_name ?? '',
  empId: r.employees?.emp_no ?? '',
  absenceType: r.leave_types?.name ?? '',
})

const toBalances = (row) => {
  if (!row) return null
  const opening = Number(row.opening_annual)
  const credited = Number(row.annual_credited)
  const utilized = Number(row.annual_utilized)
  const contCredited = Number(row.contingency_credited)
  const contUtilized = Number(row.contingency_utilized)
  const contCap = Number(row.contingency_cap)
  const total = opening + credited
  return {
    totalCredited: total,
    utilized,
    rows: [
      { key: 'opening', label: 'Opening', value: opening, max: 12 },
      { key: 'credited', label: 'Credited', value: credited, max: 18 },
      { key: 'utilized', label: 'Utilized', value: utilized, max: 18 },
      { key: 'available', label: 'Available', value: Math.max(0, total - utilized), max: 18 },
      { key: 'contUtilized', label: 'Cont. Utilized', value: contUtilized, max: contCap },
      { key: 'contAvailable', label: 'Cont. Available', value: Math.max(0, contCredited - contUtilized), max: contCap },
    ],
  }
}

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

  const setToast = useCallback((msg, kind = 'ok') => {
    setToastState({ msg, kind, id: Date.now() })
    window.clearTimeout(setToast._t)
    setToast._t = window.setTimeout(() => setToastState(null), 3200)
  }, [])

  const loadMine = useCallback(async (meId) => {
    const { data } = await supabase
      .from('leave_requests')
      .select(REQUEST_FIELDS)
      .eq('employee_id', meId)
      .order('requested_on', { ascending: false })
      .order('id', { ascending: false })
    setMine((data ?? []).map(mapRow))
  }, [])

  const loadTeam = useCallback(async (meId) => {
    const { data: reports } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', meId)
    const ids = (reports ?? []).map((r) => r.id)
    if (!ids.length) { setTeam([]); return }
    const { data } = await supabase
      .from('leave_requests')
      .select(REQUEST_FIELDS)
      .in('employee_id', ids)
      .order('requested_on', { ascending: false })
      .order('id', { ascending: false })
    setTeam((data ?? []).map(mapTeamRow))
  }, [])

  const loadBalances = useCallback(async (meId) => {
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', meId)
      .order('year', { ascending: false })
      .limit(1)
    setBalances(toBalances(data?.[0]))
  }, [])

  const loadLeaveTypes = useCallback(async () => {
    const { data } = await supabase
      .from('leave_types')
      .select('name')
      .eq('is_active', true)
      .order('id')
    setLeaveTypes((data ?? []).map((r) => r.name))
  }, [])

  const handleSession = useCallback(async (session) => {
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
      const { data: p } = await supabase
        .from('employees')
        .select('*, manager:employees ( full_name )')
        .eq('auth_user_id', user.id)
        .single()
      meRef.current.id = p?.id ?? null
      setProfile(p ?? null)
      await Promise.all([
        loadMine(p?.id),
        loadTeam(p?.id),
        loadBalances(p?.id),
        loadLeaveTypes(),
      ])
    }
    setSignedIn(true)
  }, [loadMine, loadTeam, loadBalances, loadLeaveTypes])

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

  const addMine = useCallback(async ({ type, from, to, days, mode, reason, requestedOn }) => {
    const meId = meRef.current?.id
    if (!meId) return null
    const { data: lt } = await supabase
      .from('leave_types')
      .select('id')
      .eq('name', type)
      .single()
    if (!lt) {
      setToast(`Unknown leave type: ${type}`, 'red')
      return null
    }
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: meId,
        leave_type_id: lt.id,
        start_date: from,
        end_date: to,
        days,
        mode,
        reason: reason || '(no reason given)',
        requested_on: requestedOn,
      })
      .select('request_no')
      .single()
    if (error) {
      setToast(error.message, 'red')
      return null
    }
    await loadMine(meId)
    return data.request_no
  }, [loadMine, setToast])

  const cancelMine = useCallback(async (id) => {
    const meId = meRef.current?.id
    if (!meId) return
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'Cancelled' })
      .eq('request_no', id)
      .eq('employee_id', meId)
    if (error) setToast(error.message, 'red')
    else setToast('Request cancelled', 'red')
    await loadMine(meId)
    await loadBalances(meId)
  }, [loadMine, loadBalances, setToast])

  const decide = useCallback(async (id, decision) => {
    const meId = meRef.current?.id
    if (!meId) return
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        approver_id: meId,
        decided_at: new Date().toISOString(),
      })
      .eq('request_no', id)
    if (error) setToast(error.message, 'red')
    else setToast(decision === 'Approved' ? 'Request approved' : 'Request rejected', decision === 'Approved' ? 'ok' : 'red')
    await loadTeam(meId)
  }, [loadTeam, setToast])

  const decideMany = useCallback(async (ids, decision) => {
    const meId = meRef.current?.id
    if (!meId || !ids.length) return
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: decision,
        approver_id: meId,
        decided_at: new Date().toISOString(),
      })
      .in('request_no', ids)
    if (error) setToast(error.message, 'red')
    else if (decision === 'Approved') setToast(`${ids.length} requests approved`, 'ok')
    else setToast(`${ids.length} requests rejected`, 'red')
    await loadTeam(meId)
  }, [loadTeam, setToast])

  const value = useMemo(
    () => ({
      signedIn, signIn, signOut,
      profile, mine, team, balances, leaveTypes, authReady,
      addMine, decide, decideMany, cancelMine, toast, setToast,
      CURRENT_YEAR,
    }),
    [signedIn, signIn, signOut, profile, mine, team, balances, leaveTypes, authReady, addMine, decide, decideMany, cancelMine, toast, setToast]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
