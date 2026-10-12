import { supabase } from '../lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// Identity/session calls live here so src/store never imports supabase.
// Errors are returned raw: the sign-in form surfaces supabase's own wording.
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return { session }
}

export function subscribeToAuth(cb: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(cb)
  return subscription
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}
