---
name: supabase-setup
description: Bootstrap or verify the hosted Supabase project behind the portal — schema, seed, patches, auth users, and the env-var contract
---

# Supabase setup for the leave portal

The backend is a hosted Supabase project (Postgres + Auth + RLS). SQL runs in the dashboard SQL editor; user seeding runs locally.

## Fresh install (order matters)

In the dashboard SQL editor:

1. `supabase/schema.sql` — tables, enums, RLS, SECURITY DEFINER helpers, triggers.
2. `supabase/seed.sql` — demo data (re-runnable: upserts employees/leave types/holidays/balances/sample requests).
3. **Skip** `patch-001-*.sql` and `patch-002-*.sql` on fresh installs — schema.sql already contains their fixes; run them only on installs created before those dates.

Then create the auth users (the `handle_new_user` trigger binds them to the seeded employee rows by email):

```bash
cd Leave-managment/emids-leave-portal
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<secret-key> \
node scripts/seed-users.mjs
```

- Env vars are plain (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — **never** `VITE_`-prefixed.
- Optional `SEED_PASSWORD` (default `Portal@2026`).
- The script reports `user_already_exists`/`email_exists` codes as "exists, skipped"; any OTHER failure exits non-zero (an earlier version matched the string "Unregistered API key" and misreported as success — fixed by grepping the API for real codes).
- One staff account (`vikram.deshmukh@emids.com`) exists for the e2e suite.

## Business rules live in the DB (schema.sql)

- `leave_requests_update_guard` — employees may only cancel their OWN Pending request (all other fields must be identical); managers/admins may only move Pending → Approved/Rejected with approver metadata.
- `leave_requests_balance_bump` — approvals keep `leave_balances` in sync; pool per `leave_deduction_pool()` on the type name.
- `optional_picks_max_three` — max 3 optional-holiday picks per employee/country/year. Client mirror: `MAX_PICKS` in `src/constants.js`, friendly wording via `services/holidays.js isPickCapError` (matches code P0001 / 'optional holiday'), never on raw regex against the live error.
- Keep DB enums and `src/constants.js` (STATUSES/MODES/ROLES) in sync — the constants test pins them.

## Env contract (`.env.local`, gitignored; see `.env.example`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — the web app client.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (seed script + possible e2e cleanup). If it stops working ("Unregistered API key"), rotate it in dashboard → Settings → API keys and paste the new one; never commit it and never prefix it with `VITE_`.
