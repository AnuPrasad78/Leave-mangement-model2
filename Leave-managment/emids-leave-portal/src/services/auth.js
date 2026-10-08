import { supabase } from '../lib/supabase'

// Identity/session calls live here so src/store never imports supabase.
// Errors are returned raw: the sign-in form surfaces supabase's own wording.
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return { session }
}

export function subscribeToAuth(cb) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(cb)
  return subscription
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  await supabase.auth.signOut()
}
