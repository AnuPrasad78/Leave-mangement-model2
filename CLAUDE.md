# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout (nested)

- `Leave-managment\emids-leave-portal\frontend\` — **the frontend app** (npm project root; all npm commands run from here). Also hosts `scripts\seed-users.mjs` — Node resolves its `@supabase/supabase-js` dep from the frontend's `node_modules`, so run it from `frontend\`.
- `Leave-managment\emids-leave-portal\backend\` — **the backend definition**: `backend\supabase\*.sql` (schema, seed, patches) applied manually in the hosted Supabase dashboard. No server code exists here.
- `.claude\skills\run-dev | run-tests | supabase-setup | portal-conventions\` — executable workflows for this repo (running the app, testing, backend setup, adding features)
- Claude sessions often start one folder **above** this repo root (an outer non-git folder that also holds a `.claude/launch.json` for the desktop preview) — paths seen there may contain this repo as a subfolder

## Project

React 18 + Next.js (App Router) leave-management portal ("emids-leave-portal"). TypeScript/TSX, strict mode (`npm run typecheck`) — unit tests remain `.js/.jsx` by choice (Tier 1 migration).

**Testing**: Vitest + Testing Library (unit, fully mocked) and Playwright (e2e against the real hosted Supabase), configured TDD-first. ESLint 9 (flat config) + Prettier. No CI runner configured.

## Commands

Run inside the frontend folder (or use `npm --prefix <frontend-folder>`):

```bash
npm run dev        # Next dev server (launch.json config uses 5174)
npm run build      # next build to .next/
npm test           # vitest run — unit suites, fully mocked, never touches Supabase
npm run test:watch
npm run e2e        # playwright — real hosted Supabase via dev server on :5180, needs seeded users
npm run lint       # eslint . (flat config, 0 errors expected)
npm run format     # prettier --write src tests
```

- Env config is `.env.local` (gitignored, inside `frontend\`) with `NEXT_PUBLIC_API_BASE_URL` (FastAPI backend); `frontend\.env.example` documents the full set. **Restart the dev server after changing it** — Next only reads env at startup. **Never run `npm run build` while a dev server is up** — both write `.next/`.
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) must NEVER have a `NEXT_PUBLIC_` prefix — a public-prefixed value is inlined into the client bundle.

## Architecture

All source paths below live under `frontend\` and are shown relative to it.

```
src/
  constants.js       # mirrors of the DB enums: STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons
  components/ui/     # atoms/ (Button, Field, PageHead, Chip, SegmentedControl, IconButton,
                     # StatusPill, Toast, Donut, WarnBanner) and molecules/ (PanelTable, ConfirmModal),
                     # re-exported unchanged by the components/ui/index.jsx barrel
  components/layout/ # ProfileMenu, ChatPanel (split from Layout.jsx); Layout.jsx still owns header + drawer
  components/feature/ # organisms extracted from pages, props-in (no store reads):
                     # leave-request-form/LeaveRequestForm, leave-request-queue/LeaveRequestQueue,
                     # leave-request-history/LeaveRequestHistory
  features/          # pure leave-domain rules (+ one hook): leave-requests/computeRequest
                     # (half-day day-count, validation), balances/rules (isOverdrawn, remainingAfter,
                     # EMPTY_BALANCES), holidays/ticker (findNextHoliday, formatHolidayTicker) and
                     # useHolidayPicks, separations/validateSeparation
  hooks/useDismiss.js# escape / outside-mousedown dismissal used by drawer, profile menu, ConfirmModal, ChatPanel
  services/          # every service (leaveRequests, holidays, balances, leaveTypes, employees,
                     # separations, legacyMigration, auth + errors.js) goes through apiClient.ts, which
                     # fetches same-origin /api/<path> (the Next.js BFF proxy handing the request to the
                     # FastAPI backend with the cookie's JWT). Every call returns { data, error };
                     # auth deliberately returns raw backend messages (Login's wording contract)
  store/AuthContext.jsx # central state (see below); mappings.js holds row→viewmodel mappers
  utils/             # dates (fmtDate, dayName, businessDaysBetween, todayISO — LOCAL date, not UTC),
                     # format (fmtDays), roles (canApprove), balances (balanceRow/balanceValue), ErrorBoundary
  pages/             # route-level compositions: PageHead + organisms; data via useAuth (),
                     # rules via features/ (no direct supabase or services calls)
```

### Atomic design classification

Component classification is based on responsibility and behavior rather than visual size. For example:

- **Atoms:** Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, and WarnBanner.
- **Molecules:** ConfirmModal and PanelTable because they combine reusable elements into a complete interaction or data presentation composition.
- **Organisms:** complete feature sections such as LeaveRequestForm, LeaveRequestQueue, and LeaveRequestHistory.
- **Pages:** route-level compositions such as Dashboard and ApplyLeave.

`ConfirmModal` is a molecule because it owns the complete confirmation interaction: dialog semantics, focus management, Escape/outside dismissal, focus restoration, and confirm/cancel actions. A generic `Dialog` shell may be an atom if it only provides structural accessibility behavior; feature-specific confirmation remains owned by the page or feature layer.

**Central state lives in `src/store/AuthContext.tsx`.** On sign-in it resolves the signed-in user to their `employees` row, then loads `mine` (own leave requests), `team` (requests of direct reports via `manager_id`), `balances`, and `leaveTypes` — all through the services layer, with failed loads toasted via `setToast`. Write helpers `addMine`, `cancelMine`, `decide`, `decideMany` wrap the leave-request mutations, and `setToast` is the global toast (single slot, 3200 ms, ref-based timer). Pages consume `useAuth()`.

**Routing** (`src/App.jsx`): `<Guard>` requires sign-in; `<ManagerOnly>` additionally requires `canApprove(profile)` (role `manager` or `admin`, from `src/utils/roles.js`). An `ErrorBoundary` wraps the whole tree. Toast mounts once in App.

**Auth & session (HttpOnly cookie + Next.js BFF)** — the browser never holds the JWT:

- `frontend/middleware.ts` verifies the `lp_session` cookie (jose HS256, server-only `JWT_SECRET` shared with the backend) and redirects unauthenticated users to `/login` before render. Client-side guard layouts stay as a second layer.
- `frontend/app/api/auth/{login,me,logout}/route.ts` and `frontend/app/api/[...path]/route.ts` are the BFF: they proxy the FastAPI backend (`API_INTERNAL_URL`, default `http://localhost:8000`), set/clear `lp_session` (HttpOnly, Secure, SameSite=Lax) + `lp_csrf` (readable) cookies, and forward the JWT as `Authorization: Bearer` server-side. Unsafe methods require `X-CSRF-Token` === the `lp_csrf` cookie (double-submit) — exempt only `/auth/login`.
- `src/services/apiClient.ts` fetches same-origin `/api/<path>` and broadcasts `SIGNED_OUT` on any 401. Login errors are normalized by the BFF to "Invalid login credentials" (the e2e-pinned wording). `JWT_SECRET` must match the backend's value or every check fails.

**UI conventions**: pages compose the `components/ui` primitives; their markup must stay byte-identical to the legacy app (class parity — e.g. `.hl-panel-head` survives its misleading name on purpose). Deliberate invisible additions: `aria-busy`/`aria-invalid`/`aria-describedby`, `role="status"`+`aria-live` toast, `role="dialog"`+`aria-modal`+Escape+focus-trap	modal. No page-level Supabase calls; magic strings come from `constants.js`; dates use `todayISO()` (local, fixes a UTC off-by-one).

## Business rules live in the database, not the client

`backend/supabase/schema.sql` defines:

- SECURITY DEFINER helpers: `auth_employee_id()`, `auth_system_role()`, `auth_manager_id()` — used by RLS policies and triggers.
- `leave_requests_update_guard` trigger: employees may only cancel their own Pending request (every other field must be unchanged); managers/admins may only move Pending → Approved/Rejected. **Consequence:** an UPDATE payload must touch only the allowed fields — the AuthContext helpers already do this.
- `leave_requests_balance_bump` trigger: keeps `leave_balances` in sync with approval status. Which pool a leave type draws from is decided by `leave_deduction_pool()` on the type *name*: `Contingency Bucket` → contingency; `Work From Home`, `Business Travel`, `Leave Without Pay`, `Loss Of Pay` → no deduction; everything else → annual.
- An exclusion constraint rejects overlapping Pending/Approved date ranges for the same employee ("Key conflicts with existing key") — e2e specs pick dates ~60 days out to avoid collisions.
- `optional_picks_max_three` trigger: max 3 optional-holiday picks per employee per country+year (`MAX_PICKS` in constants.js; friendly wording via `services/holidays.js isPickCapError`, never regex-on-error-message).

Other conventions: statuses/modes/roles are Postgres enums (`'Pending'/'Approved'/'Rejected'/'Cancelled'`, `'Full Day'/'First Half'/'Second Half'`, employee/manager/admin — mirrored by `src/constants.js` tests); request numbers are `LV-xxxxx` (`request_no`), employee numbers `EM-xxxxx`. Dates are plain `'YYYY-MM-DD'` strings with helpers in `src/utils/dates.js` (`fmtDate`, `dayName`, `businessDaysBetween`).

## Testing

Run from the frontend folder (`Leave-managment\emids-leave-portal\frontend`; details and commands in `.claude/skills/run-tests/SKILL.md`):

- **Unit** (`npm test`): suites mirror `src/` under `tests/unit/` (utils, store, services, features, components/ui, components/feature, components/layout, hooks, pages). The Supabase client is behind `src/lib/supabase` and mocked with `vi.mock` + the chainable fake in `tests/unit/mocks/supabase.js` — unit tests never hit the network. TDD: write the failing test first.
- **E2E** (`npm run e2e`): Playwright against the real hosted Supabase via a dev server on :5180, `workers: 1` (mutating specs are serialized). Logins from `tests/e2e/fixtures.js`: manager `sai.nithinreddy@emids.com`, staff `vikram.deshmukh@emids.com`, password `Portal@2026` (`SEED_PASSWORD` to override). Mutating specs clean up after themselves (apply-leave cancels its own `[e2e]` request; holidays unpicks; approve flows decide only in-test-created rows); specs depending on the staff account auto-skip when it isn't provisioned. `backend/supabase/seed.sql` re-seeds = reset.
- **Visual parity**: `tests/e2e/screenshot-visual.mjs` (1440×900, per role) + `compare-visual.mjs`; sets live in `tests/.visual-baseline/.visual-after` (gitignored).

### Supabase setup (SQL editor on the hosted project)

1. Fresh install: run `backend/supabase/schema.sql` once, then `backend/supabase/seed.sql`.
2. `backend/supabase/patch-001-*.sql` and `patch-002-*.sql` fix installs created before their dates — skip them on fresh installs.
3. Auth users (run from `frontend\`, where `scripts/` and its deps live): `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-users.mjs` (plain env vars, never `VITE_`-prefixed; optional `SEED_PASSWORD`, default `Portal@2026`). Creates the two managers + one staff account used by e2e. The script only treats the real `user_already_exists`/`email_exists` codes as "already seeded".

## Git conventions

- Origin: `https://github.com/AnuPrasad78/Leave-mangement-model2.git`; active working branch `atomic_design` (atomic-design refactor on top of `refactor/production-structure`).
- **Never commit or push without asking the user first** (standing user rule).
- Commit application source, configs and tests (`frontend/src/`, `frontend/tests/`, `frontend/package.json`, lint/format configs, `backend/supabase/`, `.claude/skills/`, CLAUDE.md). Leave `frontend/.env.local`, `.claude/launch.json`, `backend/supabase/.temp/`, `frontend/dist/`, `frontend/test-results/`, `frontend/tests/.visual-*/` out of commits (the root `.gitignore` covers them).
