import { createClient } from '@supabase/supabase-js'
import { DATA_MODE } from './dataMode'
import { supabaseMock } from './mockDb'

const realSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill in your Supabase project values, then restart the dev server.')
  }

  return createClient(
    url || 'https://not-configured.invalid',
    key || 'not-configured',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )
}

// One client, two backends — every screen keeps its supabase calls untouched.
// 'mock'  → lib/mockDb.js, an in-browser seeded store (no cloud).
// 'supabase' → the real project from .env.local.
export const supabase = DATA_MODE === 'mock' ? supabaseMock : realSupabase()

console.info(
  DATA_MODE === 'mock'
    ? '[leave-portal] data mode: mock — in-browser seeded store; the cloud client stays wired behind the login pill.'
    : '[leave-portal] data mode: supabase — live project from .env.local.'
)
