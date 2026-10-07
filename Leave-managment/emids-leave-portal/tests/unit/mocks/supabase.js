// Singleton chainable fake of @supabase/supabase-js for unit tests.
// Queue expected responses BEFORE the query fires; the builder matches them by
// table + operation kind (and optionally an eq column/value) in FIFO order.
// Queries that find no queued response resolve with an explicit error.
export const mockDb = createSupabaseMock()

export function createSupabaseMock() {
  const queue = []
  const calls = []
  const state = {
    session: null,
    signInResult: { error: { message: 'Invalid login credentials', code: 400 } },
    authStateCb: null,
  }

  const matches = (entry, chain) => {
    if (entry.table !== chain.table) return false
    if (entry.kind && entry.kind !== chain.kind) return false
    if (entry.eq) return chain.ops.some(([op, col, val]) => op === 'eq' && col === entry.eq[0] && val === entry.eq[1])
    return true
  }

  const builder = (table, kind) => {
    const chain = { table, kind, ops: [] }
    const setKind = (kind, op) => {
      chain.kind = kind
      return push(op)
    }
    const push = (op) => {
      chain.ops.push(op)
      return api
    }
    const resolve = () => {
      const idx = queue.findIndex((e) => matches(e, chain))
      const entry = idx >= 0 ? queue.splice(idx, 1)[0] : null
      calls.push({ table, kind, ops: chain.ops.map((o) => o.slice(0, 3)) })
      if (!entry) {
        return Promise.resolve({
          data: null,
          error: { message: `[mock] no queued response for ${kind} on "${table}"`, code: 'MOCK_UNQUEUED' },
        })
      }
      return Promise.resolve({ data: entry.data ?? null, error: entry.error ?? null, count: entry.count })
    }
    const api = {
      select: (q, opts) => push(['select', q, opts]),
      insert: (payload, opts) => setKind('insert', ['insert', payload, opts]),
      update: (payload) => setKind('update', ['update', payload]),
      delete: () => setKind('delete', ['delete']),
      upsert: (payload, opts) => push(['upsert', payload, opts]),
      eq: (col, val) => push(['eq', col, val]),
      neq: (col, val) => push(['neq', col, val]),
      in: (col, vals) => push(['in', col, vals]),
      order: (col, opts) => push(['order', col, opts]),
      limit: (n) => push(['limit', n]),
      range: (a, b) => push(['range', a, b]),
      single: () => {
        chain.ops.push(['single'])
        return resolve()
      },
      maybeSingle: () => {
        chain.ops.push(['maybeSingle'])
        return resolve()
      },
      then: (onFulfilled) => resolve().then(onFulfilled),
    }
    return api
  }

  return {
    reset: () => {
      queue.length = 0
      calls.length = 0
    },
    calls,
    from: (table) => builder(table, 'select'),
    expectSelect: (table, { eq, data, error } = {}) =>
      queue.push({ table, kind: 'select', eq, data: data ?? null, error: error ?? null }),
    expectInsert: (table, { data, error } = {}) =>
      queue.push({ table, kind: 'insert', data: data ?? null, error: error ?? null }),
    expectUpdate: (table, { data, error } = {}) =>
      queue.push({ table, kind: 'update', data: data ?? null, error: error ?? null }),
    expectDelete: (table, { error } = {}) => queue.push({ table, kind: 'delete', data: null, error: error ?? null }),
    setSession: (session) => { state.session = session },
    setSignInResult: (result) => { state.signInResult = result },
    emitAuthEvent: (event, session) => state.authStateCb?.(event, session),
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      signInWithPassword: async () => state.signInResult,
      signOut: async () => ({ error: null }),
      onAuthStateChange: (cb) => {
        state.authStateCb = cb
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  }
}
