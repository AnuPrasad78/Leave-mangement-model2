# Emids · Absence Management Portal

An employee leave portal: time-off requests, manager approvals, balances and the
holiday calendar on a React 18 + Vite + Supabase stack.

## Features

- **Dashboard** — identity, balances (donut + bars), manager queue glanceable
- **Apply Leave** — live working-days math, From→To autofill, overlap preflight,
  weekend/backdated rejection (client + server)
- **My Requests** — history per employee with cancel
- **Leave Requests (manager)** — pending-first queue, per-row and bulk
  approve/reject with audit toasts
- **Holiday Calendar** — fixed holidays by country/location/year + optional
  picks (max 3, enforced server-side)
- **Notifications** — bell with realtime badge (submission/approval/etc.)
- **Separation Request** — offboarding intent with HR routing

## Quickstart

```bash
npm install
npm run dev
```

Configure your Supabase project in `.env.local`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<secret-key>   # scripts only — never used in the browser bundle
```

Database, in this order (SQL editor):

1. `supabase/schema.sql` — tables, RLS, guards (once)
2. `supabase/patch-004-006.sql` — notifications + days recompute + overlap
   constraint (idempotent; re-runnable)
3. `supabase/seed.sql` — demo staff, team queue, balances
4. `node scripts/seed-users.mjs` — demo auth users (env: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`; password defaults to `Portal@2026`)

Demo accounts: `sai.nithinreddy@emids.com` (manager) and
`sandeep.venkateshkamath@emids.com` — password `Portal@2026`.

## Data-source toggle

The app ships with a built-in in-browser mock database (seeded from
`seed.sql`, including all server-side rules) so it runs without a cloud
project. The pill on the login screen (`DATA · MOCK ⇄ CLOUD`) or
`?data=supabase` / `?data=mock` in the URL switches backends.

## Build

```bash
npm run build   # outputs dist/
npm run preview
```

## Layout

```
src/
  lib/        supabase clients (cloud + mock), data mode
  store/      AuthContext — single data access layer
  pages/      Dashboard · ApplyLeave · LeaveDetails · LeaveRequests ·
              Holidays · SeparationRequest · Login
  components/ Layout (drawer, bell, assistant), Icons, UI primitives
supabase/     schema, seed, patch bundle, run order
scripts/      seed-users.mjs
```
