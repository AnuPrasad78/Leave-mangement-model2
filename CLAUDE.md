# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout (nested)

- `Leave-managment\emids-leave-portal\frontend\` — **the frontend app** (npm project root; all npm commands run from here).
- `Leave-managment\emids-leave-portal\backend\` — **the backend app**: a FastAPI service under `backend\api\` (`app/` package, Alembic migrations under `app/migrations` or `backend\api\migrations`, pytest suite) run against a containerized Postgres 16 via `backend\compose.yaml` (`db`, `api`, `frontend` services). No hosted Supabase — the legacy SQL project applies only if migrating data from it (see the old `supabase-setup` history).
- `.claude\skills\run-dev | run-tests | backend-setup | portal-conventions\` — executable workflows for this repo (running the app, testing, backend setup, adding features)
- Claude sessions often start one folder **above** this repo root (an outer non-git folder that also holds a `.claude/launch.json` for the desktop preview) — paths seen there may contain this repo as a subfolder

## Project

React 18 + Next.js 14 (App Router) leave-management portal ("emids-leave-portal"). TypeScript/TSX throughout (sources and tests), strict mode (`npm run typecheck` runs both `tsconfig.json` and `tsconfig.test.json`).

**Testing**: Vitest + Testing Library (unit, fully mocked) and Playwright (e2e against the real FastAPI backend via a dev server on :5180), TDD-first. ESLint 9 (flat config) + Prettier. No CI runner configured.

## Commands

Run inside the frontend folder (or use `npm --prefix <frontend-folder>`):

```bash
npm run dev        # Next dev server (launch.json config uses 5174)
npm run build      # next build to .next/
npm test           # vitest run — unit suites, fully mocked, never touches the backend
npm run typecheck  # tsc --noEmit for app + test tsconfigs
npm run e2e        # playwright — real FastAPI backend via dev server on :5180, needs seeded users
npm run lint       # eslint . (flat config, 0 errors expected)
npm run format     # prettier --write src tests
```

Backend (run from `backend\`; see the backend-setup skill):

```bash
docker compose -f backend/compose.yaml up -d db api   # Postgres 16 + FastAPI on :8000
```

- Env config is `.env.local` (gitignored, inside `frontend\`) with two server-only values: `API_INTERNAL_URL` (what the Next.js route handlers call; `http://api:8000` under compose, `http://localhost:8000` locally) and `JWT_SECRET` (must match the backend's `JWT_SECRET`). `.env.example` documents the set. **Restart the dev server after changing it** — Next only reads env at startup. **Never run `npm run build` while a dev server is up** — both write `.next/`.
- The backend needs `DEMO_PASSWORD` (default `Portal@2026`) to seed demo logins and its own `JWT_SECRET`.

## Architecture

All source paths below live under `frontend\` and are shown relative to it.

```
app/                # the Next.js App Router — the only routing layer
  layout.tsx        # root layout + providers
  providers.tsx     # wraps AuthContext (and AdminContext where needed)
  login/            # Login.tsx (co-located composition) + page.tsx stub via makeClientPage
  (portal)/(manager)/(admin)/   # route groups; each group's `layout.tsx` is the client-side guard
  api/              # the BFF: auth/{login,me,logout}/route.ts + [...path]/route.ts
(frontend root — the folders below sit beside app/):
  constants.ts      # mirrors of the backend enums: STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons
  components/ui/    # atoms/ (Button, Field, PageHead, Chip, SegmentedControl, IconButton,
                    # StatusPill, Toast, Donut, WarnBanner) and molecules/ (PanelTable, ConfirmModal,
                    # Pager), re-exported by the components/ui/index.ts barrel
  components/layout/ # header/side panels: ProfileMenu, ChatPanel, NotificationsPanel, SearchPanel;
                     # components/Layout.tsx owns header + drawer and exports NAV / ADMIN_NAV
  components/Icons.tsx
  components/feature/ # organisms extracted from pages, props-in (no store reads):
                     # leave-request-form/, leave-request-queue/, leave-request-history/, admin/
  features/          # pure leave-domain rules (+ hooks): leave-requests/computeRequest,
                     # balances/rules, holidays/ticker + useHolidayPicks, separations/validateSeparation, admin
  hooks/             # useDismiss, useDebouncedValue, usePagedData
  lib/session.ts     # server-only session helpers (jose HS256) shared by middleware + route handlers
  services/          # every service (leaveRequests, holidays, balances, leaveTypes, employees,
                     # separations, notifications, admin, legacyMigration, auth + errors.ts) goes through
                     # apiClient.ts, which fetches same-origin /api/<path> (the Next.js BFF proxy handing
                     # the request to the FastAPI backend with the cookie's JWT). Every call returns
                     # { data, error }; auth deliberately returns raw backend messages (Login's wording contract)
  store/AuthContext.tsx    # central state (see below); store/mappings.ts holds row→viewmodel mappers
  store/AdminContext.tsx   # admin persona state, mounted by the (admin) guard layout
  utils/             # dates (fmtDate, dayName, businessDaysBetween, todayISO — LOCAL date, not UTC),
                     # format (fmtDays), roles (canApprove, isAdmin), balances, ErrorBoundary.tsx
  (each route folder in app/ holds its own page composition: PageHead +
                     organisms; data via useAuth(), rules via features/ — no direct
                     transport or service calls from page markup)
```

### Atomic design classification

Component classification is based on responsibility and behavior rather than visual size. For example:

- **Atoms:** Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, and WarnBanner.
- **Molecules:** ConfirmModal, PanelTable, and Pager — combinations of reusable elements into a complete interaction or data presentation composition.
- **Organisms:** complete feature sections such as LeaveRequestForm, LeaveRequestQueue, LeaveRequestHistory, and the admin feature sections.
- **Pages:** route-level composition components co-located in their `app/<group>/<route>/` folder, mounted client-only.

`ConfirmModal` is a molecule because it owns the complete confirmation interaction: dialog semantics, focus management, Escape/outside dismissal, focus restoration, and confirm/cancel actions. A generic `Dialog` shell may be an atom if it only provides structural accessibility behavior; feature-specific confirmation remains owned by the page or feature layer.

**Central state lives in `store/AuthContext.tsx`.** On sign-in it resolves the signed-in user to their `employees` row, then loads `mine` (own leave requests), `team` (requests of direct reports via `manager_id`), `balances`, and `leaveTypes` — all through the services layer, with failed loads toasted via `setToast`. Write helpers `addMine`, `cancelMine`, `decide`, `decideMany` wrap the leave-request mutations, and `setToast` is the global toast (single slot, 3200 ms, ref-based timer). Pages consume `useAuth()`.

**Routing** is the Next.js App Router (`frontend/app/`), not a client router list. Route groups carry the persona gates as client-side *guard layouts* (second layer after `middleware.ts`):

- `(portal)/layout.tsx` — PortalGuard: signed-in users only, wraps `Layout.tsx`; redirects to `/login`.
- `(manager)/layout.tsx` — ManagerGuard: additionally requires `canApprove(profile)` (role `manager` or `admin`, from `utils/roles.ts`); redirects employees to `/dashboard`.
- `(admin)/layout.tsx` — AdminGuard: requires `isAdmin(profile)`, mounts `AdminProvider` inside `Layout.tsx`.
- `app/login/page.tsx` and every `**/page.tsx` stub render via `makeClientPage` (`app/clientPage.tsx`) — `next/dynamic` with `ssr: false`, because pages touch auth and services that do same-origin fetches that only work in the browser. Nav links live in `NAV` / `ADMIN_NAV` in `components/Layout.tsx`.

**Auth & session (HttpOnly cookie + Next.js BFF)** — the browser never holds the JWT; there is no localStorage anywhere in the auth path:

- `frontend/middleware.ts` verifies the `lp_session` cookie (jose HS256, server-only `JWT_SECRET` shared with the backend) and redirects unauthenticated users to `/login` before render. Client-side guard layouts stay as a second layer.
- `frontend/app/api/auth/{login,me,logout}/route.ts` and `frontend/app/api/[...path]/route.ts` are the BFF: they proxy the FastAPI backend (`API_INTERNAL_URL`, default `http://localhost:8000`), set/clear `lp_session` (HttpOnly, Secure, SameSite=Lax) + `lp_csrf` (readable) cookies, and forward the JWT as `Authorization: Bearer` server-side. Unsafe methods require `X-CSRF-Token` === the `lp_csrf` cookie (double-submit) — exempt only `/auth/login`.
- `services/auth.ts` resolves the session via `/api/auth/me`; `services/apiClient.ts` fetches same-origin `/api/<path>` and broadcasts `SIGNED_OUT` on any 401. Login errors are normalized by the BFF to "Invalid login credentials" (the e2e-pinned wording). `JWT_SECRET` must match the backend's value or every check fails.

**UI conventions**: pages compose the `components/ui` primitives; their markup must stay byte-identical to the legacy app (class parity — e.g. `.hl-panel-head` survives its misleading name on purpose). Deliberate invisible additions: `aria-busy`/`aria-invalid`/`aria-describedby`, `role="status"`+`aria-live` toast, `role="dialog"`+`aria-modal`+Escape+focus-trap modal. No page-level transport calls; magic strings come from `constants.ts`; dates use `todayISO()` (local, fixes a UTC off-by-one).

## Business rules live in the FastAPI backend, not the client

`backend/api/app/`:

- `leave_policy.py` — the pure policy layer: `deduction_pool()` decides what pool a leave type's days draw from by type *name* (`Contingency Bucket` → contingency; `Work From Home`, `Business Travel`, `Leave Without Pay`, `Loss Of Pay` → no deduction; everything else → annual), plus yearly entitlements and the optional-holiday pick cap.
- `routes.py` — endpoint-level enforcement: `can_decide_for()` gates who may approve (direct reports; managers/admins only move Pending → Approved/Rejected), employees may only cancel their own Pending request, and on submit it converts the `leave_requests_no_active_overlap` **exclusion constraint** (from the initial Alembic migration) into a 409 `Dates overlap another active request` — e2e specs pick dates ~60 days out to avoid collisions.
- Alembic migrations under `backend/api/migrations/versions/` (initial schema, then admin persona tables); `models.py` / `schemas.py` / `db.py` hold the SQLAlchemy layer.

**Consequence carried over from backend enforcement:** update-like payloads from the client must touch only the fields the rules allow — the AuthContext helpers already do this.

Other conventions: statuses/modes/roles are the backend enums (`Pending`/`Approved`/`Rejected`/`Cancelled`, `Full Day`/`First Half`/`Second Half`, employee/manager/admin — mirrored by `constants.ts` and its tests); request numbers are `LV-xxxxx` (`request_no`), employee numbers `EM-xxxxx`. Dates are plain `'YYYY-MM-DD'` strings with helpers in `utils/dates.ts` (`fmtDate`, `dayName`, `businessDaysBetween`).

## Testing

Run from the frontend folder (`Leave-managment\emids-leave-portal\frontend`; details and commands in `.claude/skills/run-tests/SKILL.md`):

- **Unit** (`npm test`): suites mirror `` and `app/` under `tests/unit/` (app, lib, middleware, utils, store, services, features, components/ui, components/layout, hooks, pages). All backend I/O is behind `services/*`, mocked with `vi.mock` + the spy in `tests/unit/mocks/apiClient.ts` (`apiRequest` + `resetApiClientMock()`); route handlers, middleware and `lib/session` have their own node-env suites (`@vitest-environment node` docblock). Unit tests never hit the network. TDD: write the failing test first.
- **E2E** (`npm run e2e`): Playwright against the real FastAPI backend via a dev server on :5180, `workers: 1` (mutating specs are serialized). Logins from `tests/e2e/fixtures.ts`: manager `sai.nithinreddy@emids.com`, staff `vikram.deshmukh@emids.com`, password `Portal@2026` (`SEED_PASSWORD` to override). Mutating specs clean up after themselves (apply-leave cancels its own `[e2e]` request; holidays unpicks; approve flows decide only in-test-created rows); specs depending on the staff account auto-skip when it isn't provisioned.
- **Visual parity**: `tests/e2e/screenshot-visual.mjs` (1440×900, per role) + `compare-visual.mjs`; sets live in `tests/.visual-*` (gitignored).

### Backend setup

Boot with `docker compose -f backend/compose.yaml up -d db api` — the api container entrypoint runs `alembic upgrade head` and then seeds demo data exactly once (when the DB is empty) from `app/seed_data.py` via `app/bootstrap.py`; demo users log in with `DEMO_PASSWORD` (default `Portal@2026`). Full walkthrough in `.claude/skills/backend-setup/SKILL.md`.

## Git conventions

- Origin: `https://github.com/AnuPrasad78/Leave-mangement-model2.git`; active working branches have followed the port/migration effort (`next` at the time of writing on top of `atomic_design`).
- **Never commit or push without asking the user first** (standing user rule).
- Commit application source, configs and tests (`frontend/`, `frontend/app/` where applicable, `frontend/tests/`, `frontend/package.json`, lint/format configs, `backend/`, `.claude/skills/`, CLAUDE.md). Leave `frontend/.env.local`, `.claude/launch.json`, `frontend/dist/`, `frontend/test-results/`, `frontend/tests/.visual-*/`, `backend/api/.venv/`, `backend/api/.pytest_cache/` out of commits (the gitignore setup covers them; verify with `git status` before staging).
