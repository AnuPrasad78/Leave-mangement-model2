// Creates the two demo auth users for the leave portal.
// The handle_new_user trigger in supabase/schema.sql then auto-creates
// their employee rows; supabase/seed.sql fills in the details.
//
// Usage (service_role key — NEVER prefix it with VITE_):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/seed-users.mjs
//
// Optional: SEED_PASSWORD (default below) to set the shared demo password.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_PASSWORD || 'Portal@2026'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { email: 'sai.nithinreddy@emids.com', full_name: 'Vootkuri Sai Nithin Reddy' },
  { email: 'sandeep.venkateshkamath@emids.com', full_name: 'Sandeep Venkatesh Kamath' },
]

for (const u of USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  })
  if (error) {
    if (/already|registered|duplicate/i.test(error.message)) {
      console.log(`- ${u.email} exists, skipped`)
    } else {
      console.error(`x ${u.email}: ${error.message}`)
      process.exit(1)
    }
  } else {
    console.log(`+ ${u.email} created (${data.user.id})`)
  }
}

console.log(`\nDone. Sign-in password for both accounts: ${PASSWORD}`)
console.log(`(Set SEED_PASSWORD to choose your own.)`)
