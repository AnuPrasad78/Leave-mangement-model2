# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout (nested)

- `Leave-managment\emids-leave-portal\` — **the app** (all npm commands run from here)
- Claude sessions often start one folder **above** this repo root (an outer non-git folder that also holds a `.claude/launch.json` for the desktop preview) — paths seen there may contain this repo as a subfolder

## Project

React 18 + Vite leave-management portal ("emids-leave-portal") backed by a hosted Supabase project (Postgres, Auth, RLS). Plain JSX — no TypeScript. No test runner and no linter are configured.

## Commands

Run inside the app folder (or use `npm --prefix <app-folder>`):

```bash
npm run dev        # Vite dev server, port 5173 (launch.json config uses 5174 --strictPort)
npm run build      # production build to dist/
npm run preview    # serve the build
```

- Env config is `.env.local` (gitignored) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. **Restart the dev server after changing it** — Vite only reads env at startup.
- `src/lib/supabase.js` logs a clear console error if these are missing but does not crash.

### Supabase setup (SQL editor on the hosted project)

1. Fresh install: run `supabase/schema.sql` once, then `supabase/seed.sql`.
2. `supabase/patch-001-*.sql` and `patch-002-*.sql` fix installs created before their dates — skip them on fresh installs (schema.sql already includes the fixes).
3. Create auth users with `node scripts/seed-users.mjs`, which requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (plain, **never** prefixed with `VITE_`), plus optional `SEED_PASSWORD` (default `Portal@2026`).

## Architecture

**Central state lives in `src/store/AuthContext.jsx`.** On sign-in it resolves the signed-in Supabase user to their `employees` row (`auth_user_id = user.id`), then loads `mine` (own leave requests), `team` (requests of direct reports via `manager_id`), `balances` (latest-year `leave_balances` row), and `leaveTypes`. Write helpers `addMine`, `cancelMine`, `decide`, `decideMany` wrap the leave-request mutations, and `setToast` is the global toast. Pages consume `useAuth()`; only page-local data (holidays, optional picks, separation requests on Dashboard/Holidays/SeparationRequest) is queried directly via `src/lib/supabase.js`.

**Routing** (`src/App.jsx`): `<Guard>` requires sign-in; `<ManagerOnly>` additionally requires `canApprove(profile)` (role `manager` or `admin`, checked in `src/data.js`).

**Business rules live in the database, not the client.** `supabase/schema.sql` defines:

- SECURITY DEFINER helpers: `auth_employee_id()`, `auth_system_role()`, `auth_manager_id()` — used by RLS policies and triggers.
- `leave_requests_update_guard` trigger: employees may only cancel their own Pending request (every other field must be unchanged); managers/admins may only move Pending → Approved/Rejected. **Consequence:** an UPDATE payload must touch only the allowed fields or Postgres raises an exception — keep client updates minimal (the AuthContext helpers already do this).
- `leave_requests_balance_bump` trigger: keeps `leave_balances` in sync with approval status. Which pool a leave type draws from is decided by `leave_deduction_pool()` on the type *name*: `Contingency Bucket` → contingency; `Work From Home`, `Business Travel`, `Leave Without Pay`, `Loss Of Pay` → no deduction; everything else → annual.
- `optional_picks_max_three` trigger: max 3 optional-holiday picks per employee per country+year.

Other conventions: statuses/modes/roles are Postgres enums (`'Pending'/'Approved'/'Rejected'/'Cancelled'`, `'Full Day'/'First Half'/'Second Half'`, employee/manager/admin); request numbers are `LV-xxxxx` (`request_no`), employee numbers `EM-xxxxx`. Dates are plain `'YYYY-MM-DD'` strings with helpers in `src/data.js` (`fmtDate`, `dayName`, `businessDaysBetween`).

## Git conventions

- Origin: `https://github.com/AnuPrasad78/Leave-mangement-model2.git`; active working branch is `UI-Fixes`.
- **Never commit or push without asking the user first** (standing user rule).
- Only commit application source (`src/`, `supabase/`); leave `.claude/launch.json`, `supabase/.temp/`, and `.env.local` (gitignored) out of commits.
