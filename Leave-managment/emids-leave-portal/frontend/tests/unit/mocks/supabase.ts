// Singleton chainable fake of @supabase/supabase-js for unit tests.
// Queue expected responses BEFORE the query fires; the builder matches them by
// table + operation kind (and optionally an eq column/value) in FIFO order.
// Queries that find no queued response resolve with an explicit error.
export const mockDb = createSupabaseMock()

export interface MockOp {
  op: string
  args: unknown[]
}

interface ChainState {
  table: string
  kind: string
  ops: MockOp[]
}

interface QueueEntry {
  table: string
  kind?: string
  eq?: [string, unknown]
  data?: unknown
  error?: MockError
  count?: number
}

export interface MockCall {
  table: string
  kind: string
  ops: unknown[]
}

type MockError = { message?: string; code?: string | number | null } | null

export interface SupabaseMock {
  reset: () => void
  calls: MockCall[]
  from: (table: string) => unknown
  expectSelect: (table: string, opts?: { eq?: [string, unknown]; data?: unknown; error?: MockError }) => void
  expectInsert: (table: string, opts?: { data?: unknown; error?: MockError }) => void
  expectUpdate: (table: string, opts?: { data?: unknown; error?: MockError }) => void
  expectDelete: (table: string, opts?: { error?: MockError }) => void
  setSession: (session: Record<string, unknown> | null) => void
  setSignInResult: (result: { data?: unknown; error?: { message?: string; code?: string | number } | null }) => void
  emitAuthEvent: (event: string, session: Record<string, unknown> | null) => void
}

export function createSupabaseMock(): SupabaseMock {
  const queue: QueueEntry[] = []
  const calls: MockCall[] = []
  const state: {
    session: Record<string, unknown> | null
    signInResult: { data?: unknown; error?: MockError }
    authStateCb: ((event: string, session: Record<string, unknown> | null) => void) | null
  } = {
    session: null,
    signInResult: { data: null, error: { message: 'Invalid login credentials', code: 400 } },
    authStateCb: null,
  }

  const matches = (entry: QueueEntry, chain: ChainState): boolean => {
    if (entry.table !== chain.table) return false
    if (entry.kind && entry.kind !== chain.kind) return false
    if (entry.eq) return chain.ops.some(({ op, args }) => op === 'eq' && args[0] === entry.eq?.[0] && args[1] === entry.eq?.[1])
    return true
  }

  const builder = (table: string, kind: string): Record<string, unknown> => {
    const chain: ChainState = { table, kind, ops: [] }
    const push = (tuple: [string, ...unknown[]]) => {
      chain.ops.push({ op: tuple[0], args: tuple.slice(1) })
      return api
    }
    const setKind = (nextKind: string, tuple: [string, ...unknown[]]) => {
      chain.kind = nextKind
      return push(tuple)
    }
    const resolve = () => {
      const idx = queue.findIndex((e) => matches(e, chain))
      const entry = idx >= 0 ? queue.splice(idx, 1)[0] : null
      calls.push({ table, kind: chain.kind, ops: chain.ops.map(({ op, args }) => [op, ...args.slice(0, 2)]) })
      if (!entry) {
        return Promise.resolve({
          data: null,
          error: { message: `[mock] no queued response for ${chain.kind} on "${table}"`, code: 'MOCK_UNQUEUED' },
        })
      }
      return Promise.resolve({ data: entry.data ?? null, error: entry.error ?? null, count: entry.count })
    }
    const api = {
      select: (q: unknown, opts: unknown) => push(['select', q, opts]),
      insert: (payload: unknown, opts: unknown) => setKind('insert', ['insert', payload, opts]),
      update: (payload: unknown) => setKind('update', ['update', payload]),
      delete: () => setKind('delete', ['delete']),
      upsert: (payload: unknown, opts: unknown) => push(['upsert', payload, opts]),
      eq: (col: string, val: unknown) => push(['eq', col, val]),
      neq: (col: string, val: unknown) => push(['neq', col, val]),
      in: (col: string, vals: unknown) => push(['in', col, vals]),
      order: (col: string, opts: unknown) => push(['order', col, opts]),
      limit: (n: number) => push(['limit', n]),
      range: (a: number, b: number) => push(['range', a, b]),
      single: () => {
        chain.ops.push({ op: 'single', args: [] })
        return resolve()
      },
      maybeSingle: () => {
        chain.ops.push({ op: 'maybeSingle', args: [] })
        return resolve()
      },
      then: (onFulfilled: unknown) => resolve().then(onFulfilled as never),
    }
    return api
  }

  return {
    reset: () => {
      queue.length = 0
      calls.length = 0
    },
    calls,
    from: (table: string) => builder(table, 'select'),
    expectSelect: (table: string, { eq, data, error }: { eq?: [string, unknown]; data?: unknown; error?: MockError } = {}) =>
      queue.push({ table, kind: 'select', eq, data: data ?? null, error: error ?? null }),
    expectInsert: (table: string, { data, error }: { data?: unknown; error?: MockError } = {}) =>
      queue.push({ table, kind: 'insert', data: data ?? null, error: error ?? null }),
    expectUpdate: (table: string, { data, error }: { data?: unknown; error?: MockError } = {}) =>
      queue.push({ table, kind: 'update', data: data ?? null, error: error ?? null }),
    expectDelete: (table: string, { error }: { error?: MockError } = {}) => queue.push({ table, kind: 'delete', data: null, error: error ?? null }),
    setSession: (session: Record<string, unknown> | null) => { state.session = session },
    setSignInResult: (result: { data?: unknown; error?: MockError }) => { state.signInResult = result },
    emitAuthEvent: (event: string, session: Record<string, unknown> | null) => state.authStateCb?.(event, session),
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      signInWithPassword: async () => state.signInResult,
      signOut: async () => ({ error: null }),
      onAuthStateChange: (cb: unknown) => {
        state.authStateCb = cb as (event: string, session: Record<string, unknown> | null) => void
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  } as unknown as SupabaseMock
}
