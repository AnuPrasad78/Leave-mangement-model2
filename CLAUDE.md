# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

- `Leave-managment\emids-leave-portal\frontend\` — **the frontend app** (npm project root; all npm commands run from here).
- `Leave-managment\emids-leave-portal\backend\api\` — **the backend**: FastAPI + SQLAlchemy + Alembic against a local Postgres 16, both defined in `backend\compose.yaml` (services `api` + `db`). Migrations live in `backend\api\migrations\`; demo data seeding lives in `backend\api\app\seed.py`.
- `backend\api\.env` (gitignored) — backend env: `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `CORS_ORIGINS`, `DEMO_PASSWORD` (default password for the seeded demo logins). `backend\api\.env.example` documents the set.
- `.claude\skills\run-dev | run-tests | portal-conventions\` — executable workflows for this repo (running the app, testing, adding features).

## Project

React 18 + Vite leave-management portal ("emids-leave-portal") backed by a local FastAPI + Postgres stack (JWT bearer auth, no third-party BaaS). TypeScript/TSX, strict mode (`npm run typecheck`).

**Testing**: Vitest + Testing Library (unit, fully mocked) and Playwright (e2e against the running backend), configured TDD-first. ESLint 9 (flat config) + Prettier.

## Commands

Run inside the frontend folder (or use `npm --prefix <frontend-folder>`):

```bash
npm run dev        # Vite dev server, port 5173
npm run build      # production build to dist/
npm run typecheck  # tsc over src/ and tests/
npm test           # vitest run — unit suites, fully mocked, never touch the network
npm run test:watch
npm run e2e        # playwright against the running backend, needs seeded users
npm run lint       # eslint . (flat config, 0 errors expected)
npm run format     # prettier --write src tests
```

Frontend env config lives in `frontend\.env.local` (gitignored); only `VITE_API_BASE_URL` is supported, defaulting to `http://localhost:8000`. **Restart the dev server after changing it** — Vite only reads env at startup.

Backend env lives in `backend\api\.env` (gitignored). Start the stack with Docker:

```bash
cd Leave-managment/emids-leave-portal/backend
docker compose up --build     # api on :8000, Postgres on 127.0.0.1:5432
```

Or run the API directly (needs Postgres reachable at `DATABASE_URL`):

```bash
cd Leave-managment/emids-leave-portal/backend/api
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m app.seed    # demo logins, holiday calendar, balances
```

## Architecture

All source paths below live under `frontend\` and are shown relative to it.

```
src/
  constants.ts       # mirrors of the DB enums: STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons
  components/ui/     # atoms/ (Button, Field, PageHead, Chip, SegmentedControl, IconButton,
                     # StatusPill, Toast, Donut, WarnBanner) and molecules/ (PanelTable, ConfirmModal),
                     # re-exported unchanged by the components/ui/index.ts barrel
  components/layout/ # ProfileMenu, NotificationsPanel, SearchOverlay, ChatPanel (split from Layout.tsx);
                     # Layout.tsx still owns header + drawer + bell/search state
  components/feature/ # organisms extracted from pages, props-in (no store reads):
                      # leave-request-form/LeaveRequestForm, leave-request-queue/LeaveRequestQueue,
                      # leave-request-history/LeaveRequestHistory
  features/          # pure leave-domain rules: leave-requests/computeRequest (half-day day-count,
                     # validation), balances/rules (isOverdrawn, remainingAfter, EMPTY_BALANCES),
                     # holidays/ticker (findNextHoliday, formatHolidayTicker) and useHolidayPicks,
                     # separations/validateSeparation, notifications/buildNotifications
                     # (bell items from session state), search/searchEverything (global-search index)
  hooks/useDismiss.ts# escape / outside-mousedown dismissal used by drawer, profile menu,
                     # ConfirmModal, ChatPanel, NotificationsPanel, SearchOverlay
  services/          # the ONLY layer importing src/services/apiClient: leaveRequests, holidays,
                     # balances, leaveTypes, employees, separations, legacyMigration, auth
                     # + errors.js normalize + retry.js; every call returns { data, error } with
                     # errors normalized (ServicedError); auth.js returns raw backend messages
                     # (Login's wording contract). No client-forced custom headers — custom headers
                     # widen the CORS preflight and can break every request.
  store/AuthContext.tsx # central state (see below); mappings.ts holds row→viewmodel mappers
  utils/             # dates (fmtDate, dayName, businessDaysBetween, todayISO — LOCAL date, not UTC),
                     # format (fmtDays), roles (canApprove — accepts partial profiles),
                     # balances (balanceRow/balanceValue), ErrorBoundary
  pages/             # route-level compositions: PageHead + organisms; data via useAuth(),
                     # rules via features/ (no direct apiClient or services calls)
```

### Atomic design classification

Component classification is based on responsibility and behavior rather than visual size. For example:

- **Atoms:** Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, and WarnBanner.
- **Molecules:** ConfirmModal and PanelTable because they combine reusable elements into a complete interaction or data presentation composition.
- **Organisms:** complete feature sections such as LeaveRequestForm, LeaveRequestQueue, and LeaveRequestHistory.
- **Pages:** route-level compositions such as Dashboard and ApplyLeave.

`ConfirmModal` is a molecule because it owns the complete confirmation interaction: dialog semantics, focus management, Escape/outside dismissal, focus restoration, and confirm/cancel actions. A generic `Dialog` shell may be an atom if it only provides structural accessibility behavior; feature-specific confirmation remains owned by the page or feature layer.

**Central state lives in `src/store/AuthContext.tsx`.** On sign-in it resolves the signed-in user to their `employees` row (`POST /auth/login` → JWT → `GET /employees/me`), then loads `mine` (own leave requests), `team` (requests of direct reports via `manager_id`), `balances` (latest-year `leave_balances` row), and `leaveTypes` — all through the services layer, with failed loads toasted via `setToast`. Write helpers `addMine`, `cancelMine`, `decide`, `decideMany` wrap the leave-request mutations, and `setToast` is the global toast (single slot, 3200 ms, ref-based timer). Pages consume `useAuth()`.

**Routing** (`src/App.tsx`): `<Guard>` requires sign-in; `<ManagerOnly>` additionally requires `canApprove(profile)` (role `manager` or `admin`, from `src/utils/roles.ts`). An `ErrorBoundary` wraps the whole tree. Toast mounts once in App.

**UI conventions**: pages compose the `components/ui` primitives; their markup stays class-parity faithful to the legacy app (e.g. `.hl-panel-head` survives its misleading name on purpose). Deliberate invisible additions: `aria-busy`/`aria-invalid`/`aria-describedby`, `role="status"`+`aria-live` toast, `role="dialog"`+`aria-modal`+Escape+focus-trap modal. No page-level API calls; magic strings come from `constants.ts`; dates use `todayISO()` (local, fixes a UTC off-by-one).

**Header popovers**: the bell (`NotificationsPanel`) and search overlay (`SearchOverlay`) derive everything from session state via `features/notifications/buildNotifications` and `features/search/searchEverything` — no extra endpoints, no fetches on open. A `/` hotkey opens search from any page (except while typing in an input).

## API surface (backend/api/app/routes.py)

`POST /auth/login`, `POST /auth/logout`, `GET /auth/me` + `GET /employees/me`, `GET /employees/me/team`, `GET /leave-requests/mine|team`, `POST /leave-requests`, `PUT /leave-requests/{request_no}`, `POST /leave-requests/{request_no}/cancel`, `POST /leave-requests/{request_no}/decision`, `POST /leave-requests/bulk-decision`, plus holidays/balances/separations. Auth is `Authorization: Bearer <jwt>` (HS256, `ACCESS_TOKEN_MINUTES` expiry, 401 → the client clears the token). CORS allowlist comes from `CORS_ORIGINS` — adding a new dev origin means updating it there.

## Testing

Run from the frontend folder (`Leave-managment\emids-leave-portal\frontend`; details in `.claude/skills/run-tests/SKILL.md`):

- **Unit** (`npm test`): suites mirror `src/` under `tests/unit/`. The API client is behind `src/services/apiClient` and mocked in the services layer tests — unit tests never hit the network. TDD: write the failing test first.
- **E2E** (`npm run e2e`): Playwright against the running backend via a dev server, `workers: 1` (mutating specs are serialized). Seeded demo logins use `DEMO_PASSWORD` (default `Portal@2026`) — e.g. manager `prastina.mary@emids.com`, staff `vikram.deshmukh@emids.com`. Mutating specs clean up after themselves (apply-leave cancels its own `[e2e]` request; approve flows decide only in-test-created rows); specs depending on the staff account auto-skip when it isn't provisioned. `python -m app.seed` re-seeds = reset.

## Git conventions

- Origin: `https://github.com/AnuPrasad78/Leave-mangement-model2.git`; active working branch `edited-UI-Fixes`.
- **Never commit or push without asking the user first** (standing user rule).
- Commit application source, configs and tests (`frontend/src/`, `frontend/tests/`, `frontend/package.json`, lint/format configs, `backend/api/`, `.claude/skills/`, CLAUDE.md). Leave `frontend/.env.local`, `backend/api/.env`, `.claude/launch.json`, `frontend/dist/`, `frontend/test-results/`, `frontend/tests/.visual-*/` out of commits (the root `.gitignore` covers them).
