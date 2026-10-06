// In-browser mock of the Supabase client surface this app uses.
// Speaks the same subset as @supabase/supabase-js (auth + PostgREST query
// chains + realtime postgres_changes) against a localStorage-backed store,
// seeded from seed.sql / schema.sql. Business rules live server-side in
// production (schema.sql + patches 003-006) and are replicated here so the
// UI behaves identically — same error strings, same trigger effects.
// Swap happens in lib/supabase.js; nothing below is reachable from screens.
import { buildStore, USERS } from './mockData'

const DB_KEY = 'emids-mock-db-v1'
const SESSION_KEY = 'emids-mock-auth-v1'

let db = restore()
persist()

function restore() {
  try {
    const raw = window.localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted store → reseed */ }
  return buildStore()
}

function persist() {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function sessionUser() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { uid } = JSON.parse(raw)
    return USERS.find((u) => u.uid === uid) ?? null
  } catch {
    return null
  }
}

function meEmployee() {
  const user = sessionUser()
  return user ? db.employees.find((e) => e.auth_user_id === user.uid) ?? null : null
}

const empById = (id) => db.employees.find((e) => e.id === id) ?? null
const typeById = (id) => db.leaveTypes.find((t) => t.id === id) ?? null

// Weekday count (Mon–Fri, inclusive) over a date range.
function weekdayCount(from, to) {
  let n = 0
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  for (let day = d; day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dow = day.getUTCDay() // 0 Sun .. 6 Sat
    if (dow >= 1 && dow <= 5) n++
  }
  return n
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// schema.sql leave_deduction_pool(): which balance pool a leave type draws from
function deductionPool(leaveTypeId) {
  const name = typeById(leaveTypeId)?.name
  if (name === 'Contingency Bucket') return 'contingency'
  if (name === 'Work From Home' || name === 'Business Travel' || name === 'Leave Without Pay' || name === 'Loss Of Pay') return null
  return 'annual'
}

// ---------- realtime ----------
const channels = new Map() // name → { filter: {col, val} | null, cb, table }

function realtimeDispatch(table, col, val, payload) {
  // External events travel async — keep a beat so it feels like a server push.
  setTimeout(() => {
    channels.forEach((ch) => {
      if (ch.table !== table) return
      if (ch.cb && ch.filter && ch.filter.col === col && ch.filter.val === val) ch.cb(payload)
    })
  }, 80)
}

function pushNotification(recipientId, actorId, type, requestNo, message) {
  const row = {
    id: `n-${db.seqNotifId++}`,
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    request_no: requestNo,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  }
  db.notifications.push(row)
  realtimeDispatch('notifications', 'recipient_id', recipientId, { eventType: 'INSERT', new: { ...row }, old: {} })
}

// patch-004 trigger 1: submission → notify the employee's manager
function notifySubmission(row) {
  const emp = empById(row.employee_id)
  if (!emp?.manager_id) return
  const t = typeById(row.leave_type_id)
  const daysText = Number.isInteger(row.days) ? String(row.days) : String(row.days)
  pushNotification(
    emp.manager_id, row.employee_id, 'leave_submitted', row.request_no,
    `${emp.full_name} applied for ${daysText} ${t?.name ?? 'leave'} (${row.mode}) from ${row.start_date} to ${row.end_date}`
  )
}

// patch-004 trigger 2: status change → notify the request's employee
function notifyStatus(row, actorId) {
  const ev = { Approved: 'leave_approved', Rejected: 'leave_rejected', Cancelled: 'leave_cancelled' }[row.status]
  if (!ev) return
  const actor = empById(actorId)
  const t = typeById(row.leave_type_id)
  pushNotification(
    row.employee_id, actorId, ev, row.request_no,
    `Your request ${row.request_no} (${t?.name ?? 'leave'}, ${row.start_date} to ${row.end_date}) was ${row.status} by ${actor?.full_name ?? 'someone'}`
  )
}

// schema.sql trigger 3: balances move when a request enters/leaves Approved
function bumpBalance(row, wasApproved, nowApproved) {
  const pool = deductionPool(row.leave_type_id)
  if (!pool) return
  const delta = (nowApproved ? row.days : 0) - (wasApproved ? row.days : 0)
  if (delta === 0) return
  const year = Number(row.start_date.slice(0, 4))
  let bal = db.balances.find((b) => b.employee_id === row.employee_id && b.year === year)
  if (delta > 0) {
    if (!bal) {
      // mirror the trigger's upsert defaults for staff without a balance row
      bal = {
        id: db.seqRowId++,
        employee_id: row.employee_id,
        year,
        opening_annual: 0,
        annual_credited: 18,
        annual_utilized: 0,
        contingency_credited: 10,
        contingency_utilized: 0,
        annual_cap: 18,
        contingency_cap: 10,
      }
      db.balances.push(bal)
    }
    if (pool === 'annual') bal.annual_utilized += delta
    else bal.contingency_utilized += delta
  } else if (bal) {
    if (pool === 'annual') bal.annual_utilized = Math.max(0, bal.annual_utilized + delta)
    else bal.contingency_utilized = Math.max(0, bal.contingency_utilized + delta)
  }
}

// schema.sql trigger 2 (update guard). Returns an error object or null.
function guardUpdate(row, payload) {
  const me = meEmployee()
  if (!me) return { message: 'You are not allowed to edit this request' }
  const isSelf = row.employee_id === me.id
  const isManager = me.system_role === 'admin'
    || db.employees.some((e) => e.id === row.employee_id && e.manager_id === me.id)

  if (isSelf) {
    if (payload.status === 'Cancelled' && row.status === 'Pending') return null
    return { message: 'You can only cancel your own pending request' }
  }
  if (isManager) {
    if (row.status === 'Pending' && (payload.status === 'Approved' || payload.status === 'Rejected')) return null
    return { message: 'Only pending requests can be approved or rejected' }
  }
  return { message: 'You are not allowed to edit this request' }
}

// ---------- leave_requests projections ----------
const REQUEST_COL_LIST = ['id', 'request_no', 'employee_id', 'start_date', 'end_date', 'days', 'mode', 'reason', 'status', 'requested_on']

function projectRequest(row, proj = '') {
  const base = {}
  REQUEST_COL_LIST.forEach((c) => { base[c] = row[c] })
  if (proj?.includes('leave_types!')) {
    base.leave_types = { name: typeById(row.leave_type_id)?.name ?? null }
  }
  if (proj?.includes('employees!')) {
    const emp = empById(row.employee_id)
    base.employees = emp ? { full_name: emp.full_name, emp_no: emp.emp_no } : null
  }
  return base
}

function overlapError(row) {
  // patch-006: one live request per employee per date range (EXCLUDE gist)
  const clash = db.leaveRequests.find(
    (r) => r.id !== row.id
      && r.employee_id === row.employee_id
      && (r.status === 'Pending' || r.status === 'Approved')
      && r.start_date <= row.end_date && r.end_date >= row.start_date
  )
  if (clash) return { message: 'conflicting key value violates exclusion constraint "leave_requests_no_overlap"' }
  return null
}

// ---------- executor ----------
function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every(([op, col, val]) => {
      if (op === 'eq') return row[col] === val
      if (op === 'in') return Array.isArray(val) && val.includes(row[col])
      return true
    })
  )
}

function applyOrderLimit(rows, ord, lim) {
  const out = [...rows]
  out.sort((a, b) => {
    for (const [col, asc] of ord) {
      const va = a[col]
      const vb = b[col]
      if (va === vb) continue
      const c = va < vb ? -1 : 1
      return asc ? c : -c
    }
    return 0
  })
  return lim == null ? out : out.slice(0, lim)
}

function selectOne(rows, needSingle) {
  if (!needSingle) return { data: rows, error: null }
  if (rows.length === 1) return { data: rows[0], error: null }
  return { data: null, error: { message: `JSON object requested, multiple (or no) rows returned`, code: 'PGRST116' } }
}

const padRequestNo = (n) => `LV-${String(n).padStart(5, '0')}`

function execLeaveRequests(q) {
  const me = meEmployee()

  if (q.op === 'select') {
    const rows = applyFilters(db.leaveRequests, q.filters)
    const sorted = applyOrderLimit(rows, q.ord, q.lim).map((r) => projectRequest(r, q.proj))
    return selectOne(sorted, q.single)
  }

  if (q.op === 'insert') {
    const p = Array.isArray(q.payload) ? q.payload[0] : q.payload
    if (!me || p.employee_id !== me.id) {
      return { data: null, error: { message: 'new row violates row-level security policy for table "leave_requests"' } }
    }
    if (p.end_date < p.start_date) {
      return { data: null, error: { message: 'new row for relation "leave_requests" violates check constraint "leave_requests_span_sanity"' } }
    }
    if (p.start_date < todayIso()) {
      return { data: null, error: { message: `Leave cannot start in the past (start date ${p.start_date})` } }
    }
    const weekdays = weekdayCount(p.start_date, p.end_date)
    if (weekdays === 0) {
      return { data: null, error: { message: 'A leave request needs at least one working day (weekend-only ranges are not bookable)' } }
    }
    const days = p.mode === 'Full Day' ? weekdays : weekdays * 0.5
    const row = {
      id: db.seqRowId++,
      request_no: padRequestNo(db.seqRequestId++),
      employee_id: me.id,
      leave_type_id: p.leave_type_id,
      start_date: p.start_date,
      end_date: p.end_date,
      days,
      mode: p.mode ?? 'Full Day',
      reason: p.reason ?? '(no reason given)',
      status: 'Pending',
      approver_id: null,
      decided_at: null,
      requested_on: p.requested_on ?? todayIso(),
      created_at: new Date().toISOString(),
    }
    const oe = overlapError(row)
    if (oe) return { data: null, error: oe }
    db.leaveRequests.push(row)
    notifySubmission(row)
    persist()
    if (q.proj && q.proj.includes('request_no')) {
      return { data: { request_no: row.request_no }, error: null }
    }
    return { data: projectRequest(row, ''), error: null }
  }

  if (q.op === 'update') {
    const targets = applyFilters(db.leaveRequests, q.filters)
    if (!targets.length) return { data: null, error: null }
    const row = targets[0]
    const guard = guardUpdate(row, q.payload)
    if (guard) return { data: null, error: guard }

    const prevStatus = row.status
    const wasApproved = prevStatus === 'Approved'
    row.status = q.payload.status
    row.approver_id = q.payload.approver_id ?? row.approver_id
    row.decided_at = q.payload.decided_at ?? row.decided_at
    if (prevStatus !== row.status) {
      bumpBalance(row, wasApproved, row.status === 'Approved')
      // patch-004 trigger 2: who caused it — the approver stamps approver_id; a self-cancel does not
      const actorId = row.approver_id ?? (row.status === 'Cancelled' ? row.employee_id : row.employee_id)
      notifyStatus(row, actorId)
    }
    persist()
    return { data: null, error: null }
  }

  return { data: null, error: { message: `unsupported mock op ${q.op} on ${q.table}` } }
}

function execNotifications(q) {
  if (q.op === 'select') {
    const rows = applyFilters(db.notifications, q.filters)
    const sorted = applyOrderLimit(rows, q.ord, q.lim).map((n) => ({
      id: n.id, type: n.type, request_no: n.request_no, message: n.message, is_read: n.is_read, created_at: n.created_at,
    }))
    return selectOne(sorted, q.single)
  }
  if (q.op === 'update') {
    const targets = applyFilters(db.notifications, q.filters)
    targets.forEach((n) => {
      if ('is_read' in q.payload) n.is_read = q.payload.is_read
      realtimeDispatch('notifications', 'recipient_id', n.recipient_id, { eventType: 'UPDATE', new: { ...n }, old: {} })
    })
    persist()
    return { data: null, error: null }
  }
  return { data: null, error: { message: `unsupported mock op ${q.op} on notifications` } }
}

function execBalances(q) {
  const rows = applyFilters(db.balances, q.filters)
  const sorted = applyOrderLimit(rows, q.ord, q.lim)
  return selectOne(sorted, q.single)
}

function execLeaveTypes(q) {
  const all = db.leaveTypes
  if (q.op !== 'select') return { data: null, error: { message: 'leave_types is read-only in mock' } }
  const rows = applyFilters(all, q.filters)
  const sorted = applyOrderLimit(rows, q.ord, q.lim)
  const proj = q.proj && q.proj !== '*'
    ? sorted.map((r) => {
        const o = {}
        q.proj.split(',').map((s) => s.trim()).forEach((c) => { o[c] = r[c] })
        return o
      })
    : sorted
  return selectOne(proj, q.single)
}

function execEmployees(q) {
  if (q.op !== 'select') return { data: null, error: { message: 'employees is read-only in mock' } }
  const rows = applyFilters(db.employees, q.filters)
  const sorted = applyOrderLimit(rows, q.ord, q.lim).map((r) => {
    const base = { ...r }
    if (q.proj?.includes('manager:employees')) {
      const mgr = r.manager_id ? empById(r.manager_id) : null
      base.manager = mgr ? [{ full_name: mgr.full_name }] : []
    }
    return base
  })
  return selectOne(sorted, q.single)
}

function execHolidays(q) {
  if (q.op !== 'select') return { data: null, error: { message: 'holidays is read-only in mock' } }
  const rows = applyFilters(db.holidays, q.filters)
  const sorted = applyOrderLimit(rows, q.ord, q.lim).map((h) => ({
    id: h.id, country: h.country, location: h.location, year: h.year, kind: h.kind, holiday_date: h.holiday_date, name: h.name,
  }))
  return selectOne(sorted, q.single)
}

function execPicks(q) {
  if (q.op === 'select') {
    const rows = applyFilters(db.picks, q.filters)
    const sorted = applyOrderLimit(rows, q.ord, q.lim).map((p) => ({ holiday_id: p.holiday_id }))
    return selectOne(sorted, q.single)
  }
  if (q.op === 'insert') {
    const items = Array.isArray(q.payload) ? q.payload : [q.payload]
    for (const p of items) {
      // schema.sql trigger 4: max 3 optional picks per employee per country+year
      const holiday = db.holidays.find((h) => h.id === p.holiday_id)
      const count = db.picks.filter((x) => {
        if (x.employee_id !== p.employee_id) return false
        const h = db.holidays.find((h2) => h2.id === x.holiday_id)
        return h && h.country === holiday?.country && h.year === holiday?.year
      }).length
      if (count >= 3) return { data: null, error: { message: 'You can choose only 3 optional holidays per year' } }
      const dup = db.picks.some((x) => x.employee_id === p.employee_id && x.holiday_id === p.holiday_id)
      if (!dup) db.picks.push({ employee_id: p.employee_id, holiday_id: p.holiday_id })
    }
    persist()
    return { data: null, error: null }
  }
  if (q.op === 'delete') {
    const targets = applyFilters(db.picks, q.filters)
    db.picks = db.picks.filter((p) => !targets.includes(p))
    persist()
    return { data: null, error: null }
  }
  return { data: null, error: { message: `unsupported mock op ${q.op} on optional_holiday_picks` } }
}

function execSeparations(q) {
  if (q.op !== 'insert') return { data: null, error: { message: 'separation_requests only supports insert in mock' } }
  const p = Array.isArray(q.payload) ? q.payload[0] : q.payload
  const row = {
    id: db.seqRowId++,
    employee_id: p.employee_id,
    last_working_day: p.last_working_day,
    reason: p.reason,
    remarks: p.remarks ?? null,
    status: 'Pending',
    reviewed_by: null,
    decided_at: null,
    created_at: new Date().toISOString(),
  }
  db.separations.push(row)
  persist()
  return { data: null, error: null }
}

const EXECUTORS = {
  employees: execEmployees,
  leave_types: execLeaveTypes,
  leave_requests: execLeaveRequests,
  leave_balances: execBalances,
  holidays: execHolidays,
  optional_holiday_picks: execPicks,
  separation_requests: execSeparations,
  notifications: execNotifications,
}

function exec(q) {
  try {
    const run = EXECUTORS[q.table]
    if (!run) return Promise.resolve({ data: null, error: { message: `mock has no table "${q.table}"` } })
    return Promise.resolve(run(q))
  } catch (e) {
    return Promise.resolve({ data: null, error: { message: e?.message ?? 'mock error' } })
  }
}

function makeBuilder(table) {
  const q = { table, op: 'select', filters: [], ord: [], lim: null, single: false, proj: '*', payload: null }
  const b = {
    select(proj) {
      if (proj !== undefined) q.proj = proj
      return b
    },
    eq(col, val) { q.filters.push(['eq', col, val]); return b },
    in(col, val) { q.filters.push(['in', col, val]); return b },
    order(col, opts = {}) { q.ord.push([col, opts.ascending !== false]); return b },
    limit(n) { q.lim = n; return b },
    single() { q.single = true; return b },
    insert(payload) { q.op = 'insert'; q.payload = payload; return b },
    update(payload) { q.op = 'update'; q.payload = payload; return b },
    delete() { q.op = 'delete'; return b },
    then(onF, onR) { return exec(q).then(onF, onR) },
    catch(onR) { return exec(q).catch(onR) },
  }
  return b
}

// ---------- auth ----------
const authListeners = new Set()

function fireAuth(event, session) {
  authListeners.forEach((cb) => cb(event, session))
}

const auth = {
  async getSession() {
    const u = sessionUser()
    return { data: { session: u ? { user: { id: u.uid, email: u.email } } : null }, error: null }
  },
  async getUser() {
    const u = sessionUser()
    return { data: { user: u ? { id: u.uid, email: u.email } : null }, error: null }
  },
  async signInWithPassword({ email, password }) {
    const u = USERS.find((x) => x.email.toLowerCase() === String(email ?? '').toLowerCase())
    if (!u || u.password !== password) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
    }
    const session = { user: { id: u.uid, email: u.email }, access_token: 'mock-access-token' }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: u.uid }))
    fireAuth('SIGNED_IN', session)
    return { data: { user: session.user, session }, error: null }
  },
  async signOut() {
    window.localStorage.removeItem(SESSION_KEY)
    fireAuth('SIGNED_OUT', null)
    return { error: null }
  },
  onAuthStateChange(cb) {
    authListeners.add(cb)
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }
  },
}

export function __mockReset() {
  window.localStorage.removeItem(DB_KEY)
  db = buildStore()
  persist()
}

export const supabaseMock = {
  auth,
  from: (table) => makeBuilder(table),
  channel(name) {
    const parseFilter = (raw) => {
      // supabase-js filter shape: 'recipient_id=eq.<val>'
      const m = raw?.match(/^([a-z_]+)\s*=\s*eq\.(.+)$/i)
      return m ? { col: m[1], val: m[2] } : null
    }
    const handle = {
      table: 'notifications',
      filter: null,
      cb: null,
      _name: name,
      on(type, opts, cb) {
        handle.filter = typeof opts?.filter === 'string' ? parseFilter(opts.filter) : opts?.filter ?? null
        handle.cb = cb
        return handle
      },
      subscribe() {
        channels.set(name, handle)
        return handle
      },
      name,
    }
    return handle
  },
  removeChannel(handle) {
    // supabase-js passes the RealtimeChannel object straight back
    let dropped = false
    channels.forEach((ch, name) => {
      if (ch === handle || ch._name === handle?._name) {
        channels.delete(name)
        dropped = true
      }
    })
    return dropped ? Promise.resolve('ok') : Promise.resolve('error')
  },
}
