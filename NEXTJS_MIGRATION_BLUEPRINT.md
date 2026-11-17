# Next.js Migration Blueprint — emids-leave-portal

**Scope:** React 18 + TypeScript + Vite SPA → Next.js App Router. The FastAPI backend at `Leave-managment/emids-leave-portal/backend/api` remains the system of record and is **not** rewritten, replaced, or modified.

**Nature of document:** migration blueprint only. No implementation was performed; no project files were created, modified, renamed, or deleted during analysis. Everything below was verified by reading actual source files.

---

## 1. Executive Summary of Existing Application

The emids-leave-portal is an enterprise leave-management portal with a three-role model (employee / manager / admin). Its **frontend is a fully-TypedScript React 18 SPA** (Vite 5, react-router-dom v6, hand-rolled atomic-design component library, four plain global CSS files, no UI framework, no chart library — the single "chart" is a custom SVG `Donut`). Its **backend is a FastAPI application** (`backend/api/app`) on PostgreSQL 16 via SQLAlchemy 2.0 ORM, with Alembic migrations, PyJWT HS256 bearer tokens, argon2 password hashing, RBAC enforced server-side, append-only audit logs, and a rich admin persona (employee CRUD, password resets, balance sheets, stale-request investigation, nudges, carry-forward, leave policies).

The SPA talks to FastAPI exclusively through one fetch wrapper, `src/services/apiClient.ts`, which reads the base URL from `VITE_API_BASE_URL` and keeps the bearer token in `localStorage` under key `leave-portal-access-token`. All state lives in two React contexts (`src/store/AuthContext.tsx`, `src/store/AdminContext.tsx`). Unit tests (Vitest + Testing Library + mocked `apiClient`) and e2e tests (Playwright against a dev server on :5180 with UI-login fixtures) are extensive and well-organized.

**Verification notes against the stated assumptions in the request:**

| Assumption in request | Verified reality |
|---|---|
| React + TypeScript + Vite | ✔ Confirmed (React 18.3.1, TypeScript 5.9.3, Vite 5.4.11) |
| react-router (version unspecified) | ✔ react-router-dom **6.30.3** (`<Routes>/<Route>`, inline guard components) |
| Context API / state management | ✔ Two custom React contexts; no Redux/Zustand/react-query/SWR |
| FastAPI + PostgreSQL + SQLAlchemy + Alembic + JWT + RBAC | ✔ All confirmed in `backend/api` |
| UI component libraries | ✘ **None** — 100% bespoke (`src/components/ui/*`) |
| Charts and analytics libraries | ✘ **None** — custom SVG `Donut.tsx`, CSS bar meters. No recharts/chart.js/d3 |
| Notifications | ✔ Implemented as DB-backed `notifications` table + 10s polling in `Layout.tsx` |
| Charts/analytics dashboards | ✔ Present, but rendered with DOM/SVG, not a charting library |
| Backend "must remain FastAPI" | ✔ Honored — the blueprint adds zero backend changes |

**A legacy backend also exists in history:** CLAUDE.md and stale code comments reference a Supabase backend (`backend/supabase/*.sql`). In the current tree Supabase is **fully removed** (`backend/` contains only `api/` and `compose.yaml`; zero runtime imports; only 3 stale comments in `constants.ts`, `employees.ts`, `dates.ts` plus `scripts/seed-users.mjs`). One migration-relevant artifact survives from it: `src/data/legacyHolidayData.ts` and `src/services/legacyMigration.ts`, a one-time localStorage import of previously picked optional holidays.

**Rough size:** frontend `src/` ≈ 6,010 LOC TS/TSX across ~70 files + ~1,450 LOC plain CSS; backend `app/` ≈ 2,906 LOC Python across 13 modules; 228 frontend unit/e2e test assets + 22 backend test files (~166 tests).

---

## 2. Verified Technology Stack and Versions

### Frontend (from `frontend/package.json`)

| Concern | Technology | Version | Where it lives |
|---|---|---|---|
| UI runtime | React | 18.3.1 (`react`, `react-dom`) | `src/main.tsx` |
| Bundler/dev server | Vite | 5.4.11 (`@vitejs/plugin-react` 4.6.0) | `vite.config.ts` |
| Language | TypeScript | 5.9.3, `strict: true`, `noUnusedLocals/Parameters` | `tsconfig.json` (+`tsconfig.test.json`, `tsconfig.e2e.json`) |
| Routing | react-router-dom | 6.30.3 | `src/App.tsx` |
| State | React Context API | — | `src/store/AuthContext.tsx`, `src/store/AdminContext.tsx` |
| Styling | Plain global CSS (4 files, ~1,452 lines) | — | `src/styles/global.css`, `layout.css`, `login.css`, `pages.css` |
| Fonts | Plus Jakarta Sans Variable | @fontsource-variable/plus-jakarta-sans ^5.3.0 | imported in `src/main.tsx` |
| HTTP | Native `fetch` wrapper | — | `src/services/apiClient.ts` |
| Auth | Bearer JWT in `localStorage` key `leave-portal-access-token` | — | `apiClient.ts` |
| Forms/validation | Hand-rolled (`src/features/*/validate*`) — no react-hook-form/yup/zod | — | `LeaveRequestForm.tsx`, `EmployeeEditor.tsx`, etc. |
| Tables | Hand-rolled (`PanelTable`, `Pager`) — no tanstack-table | — | `src/components/ui/molecules/` |
| Testing | Vitest 2.1.9 + Testing Library 16 + jsdom; Playwright 1.63.0 | — | `tests/unit/**`, `tests/e2e/**` |
| Lint/format | ESLint 9 flat config, Prettier 3.9.9, jsx-a11y, react-hooks | — | `eslint.config.js` |
| Visual tests | pixelmatch 5.3.0 + pngjs 7 | — | `tests/e2e/screenshot-visual.mjs`, `compare-visual.mjs` |
| Charts | **None** (custom SVG `Donut`) | — | `src/components/ui/atoms/Donut.tsx` |
| Icons | **None** (20 inline SVGs in `src/components/Icons.tsx`) | — | — |

### Backend (from `backend/api/requirements.txt` and source)

| Concern | Technology | Version pin | Notes |
|---|---|---|---|
| API | FastAPI | latest (no pin) | `app/main.py`, single module-level app |
| Server | uvicorn[standard] | — | `compose.yaml` CMD |
| ORM | SQLAlchemy | >=2.0,<3.0 | `app/models.py` (344 LOC) |
| Driver | psycopg[binary] | >=3.2,<4.0 | PostgreSQL 16 |
| Migrations | Alembic | >=1.14,<2.0 | `migrations/`, 2 revisions |
| Auth tokens | PyJWT | >=2.10,<3.0 | HS256, `sub` + `exp`, 12 h (ACCESS_TOKEN_MINUTES=720) |
| Passwords | pwdlib[argon2] | argon2id via `PasswordHash.recommended()` | `app/security.py` |
| Node modules referenced in request | Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT, RBAC, REST | — | ✔ all real; **pydantic** (via fastapi) + pydantic-settings + OpenTelemetry (api/sdk fastapi/sqlalchemy instrumentor, OTLP gRPC exporter) |

### Backend stays FastAPI

Constraint honored: every proposal in this document treats `backend/api` as immutable. The frontend migration is purely a Next.js concern.

---

## 3. Complete Frontend Architecture

All paths relative to `frontend/`. This section inventories entry points, routing, state, data access, and cross-file wiring; per-file migration disposition is in §11.

### 3.1 Entry point and initialization

- `index.html` — static shell, `<div id="root">`, title "Emids · Leave Management".
- `src/main.tsx` — `ReactDOM.createRoot` → `<React.StrictMode>` → `<AuthProvider>` → `<BrowserRouter>` → `<App>`; imports all four global CSS files + the fontsource variable font. This is the module that disappears entirely when moving to App Router (Next supplies the document shell and providers go into a client `Providers` component).

### 3.2 Application component and routing (`src/App.tsx`)

`<Routes>` with 14 entries. Guards are **inline components in App.tsx** (not separate files): `Guard`, `ManagerOnly`, `AdminOnly` — each reads `useAuth()` (`signedIn`, `authReady`, `profile`).

- `Guard`: `!authReady → null`; `!signedIn → <Navigate to="/login" state={{ from: location.pathname }}>`; else renders children inside `<Layout>`.
- `ManagerOnly`: Guard + `!canApprove(profile) → <Navigate to="/dashboard">` (`canApprove` from `src/utils/roles.ts`).
- `AdminOnly`: Guard + `!isAdmin(profile) → <Navigate to="/dashboard">`; wraps children in `<AdminProvider>` inside `<Layout>`.
- `<ErrorBoundary>` (`src/utils/ErrorBoundary.tsx`) wraps the whole tree; `<Toast/>` mounts once at app root.

Full route table with migration mapping is in §5.

### 3.3 State management

- **`AuthContext.tsx`** (`AuthProvider`, `useAuth()` with a non-null contract): state = `signedIn`, `profile` (`EmployeeProfileRow|null`), `mine: LeaveRequestRow[]`, `team: TeamRequestRow[]`, `balances: BalanceSummary|null`, `leaveTypes: string[]`, `authReady`, `toast`, `CURRENT_YEAR`. Boot effect calls `getSession()` → `handleSession`; sign-in via `signIn(email, password)` (returns error string or null). Write helpers — `addMine` (POST, fills `'(no reason given)'` when reason is blank; throws `OutcomeUnknownError` on ambiguous failures), `updateMine` (PUT), `cancelMine`, `decide`, `decideMany` — each reloads the affected lists afterwards. Toast = single global slot (`setToast(msg, kind='ok')`), 3,200 ms auto-clear via ref timer.
- **`AdminContext.tsx`** (`AdminProvider` mounted *only* inside the `AdminOnly` guard): employee table state — `rows`, `total`, `page`, `pageCount`, `loading`, `search`, `reloadNonce`; debounced search (`useDebouncedValue(search, 300)`), page reset on search change, sequence-ref guard so only the newest fetch lands. Actions: `createEmployee`, `updateEmployee`, `setEmployeeActive`, `initPasswordReset`, each followed by `reload(search)`.
- **`mappings.ts`**: `mapRow`, `mapTeamRow`, `toBalances` — DB-shaped rows → view models (e.g., `LeaveRequestRow.id = request_no`; `BalanceSummary` precomputes 6 bar-row values for dashboard meters).
- Pages consume contexts via `useAuth()`/`useAdmin()`; the seven feature organisms (`src/components/feature/*`) are pure props-in components with no store access — an excellent foundation for any framework migration.

### 3.4 API client and services (the only fetch seam)

- `src/services/apiClient.ts` — the **only** module touching `fetch`: `API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'` (trailing slash stripped); attaches `Authorization: Bearer …` when a token exists; JSON content-type on write; generates a W3C `traceparent` header via `crypto.getRandomValues`; on 401 clears the token; non-OK throws `ApiError` (`body.detail ?? body.message ?? statusText`, plus `status`, `Retry-After`); 204 → `undefined`.
- `src/services/retry.ts` — `withQueryRetry(op, {retries:2, baseDelayMs:400})`: retries only transient failures (429/500/502/503/504 or network-ish messages), exponential backoff ×2 cap 3 s with ±30% jitter, honors `Retry-After` (cap 5 s). **Reads only.**
- `src/services/errors.ts` — `withServiceErrors` wraps every service call; the seam keeps the legacy `{ data, error }` shape even though the transport is REST (`normalizeServiceError` maps the overlap-constraint error to "You have applied leave on the same day"; `outcomeUnknown` flags mutations that may have committed).
- Service modules: `auth.ts`, `employees.ts`, `balances.ts`, `leaveRequests.ts`, `holidays.ts`, `leaveTypes.ts`, `notifications.ts`, `separations.ts`, `admin.ts` (enumerated endpoint-by-endpoint in §6), `legacyMigration.ts` (no own transport).
- Every service + `apiClient.ts` is unit-mocked at `tests/unit/mocks/apiClient.ts` (`apiRequest = vi.fn()` seam) — no network in unit tests.

### 3.5 Reusable components (atomic design)

- **Atoms** (`src/components/ui/atoms/`): `Button`, `Field`, `IconButton`, `Chip`, `SegmentedControl`, `PageHead`, `StatusPill`, `Toast` (role="status" aria-live), `Donut` (pure SVG), `WarnBanner`. Re-exported unchanged by `src/components/ui/index.ts`.
- **Molecules**: `ConfirmModal` (full dialog semantics: role="dialog", aria-modal, Escape, focus-trap with shift-Tab wrap, opener focus restore), `PanelTable` (`.card` → `.hl-panel-head` → `.table-scroll > table.table`, `PanelColumn` descriptors, generic), `Pager`.
- **Layout** (`src/components/Layout.tsx`, 381 LOC): header, animated drawer (`useDismiss`), `NAV`/`ADMIN_NAV` arrays (nav filtered by `isAdmin`/`canApprove`), pending badge, drawer balance counts, **notification unread badge with 10-second polling + visibilitychange/focus refresh**, `document.title` sync, mounts `ProfileMenu`, `NotificationsPanel`, `SearchPanel`, `ChatPanel` FAB.
- **Layout children** (`src/components/layout/`): `ProfileMenu` (role="dialog"), `NotificationsPanel` (fetch-on-open + `markAllNotificationsRead()`), `ChatPanel` (hardcoded demo, honesty line "DEMO · RESPONSES DISABLED", Escape-only dismissal), `SearchPanel` (client-side filter over `mine`/`team`; admins additionally get debounced server search `fetchAdminEmployees({search, pageSize:5})`, `MIN_QUERY=2`).
- **Feature organisms** (`src/components/feature/`): `leave-request-form/LeaveRequestForm` + `OptionalHolidayCalendar` (Monday-first hand-built month grid), `leave-request-queue/LeaveRequestQueue`, `leave-request-history/LeaveRequestHistory`, and `admin/EmployeeTable`, `EmployeeEditor`, `AuditLogTable`.
- **Icons**: `src/components/Icons.tsx`, 20 inline SVGs.

### 3.6 CSS and styling architecture

Four plain global stylesheets imported in `main.tsx` in order: `global.css` (281) → `layout.css` (382) → `login.css` (135) → `pages.css` (696). Design system: teal-on-white editorial look; `:root` design tokens in `global.css` only (`--teal*`, `--ink/--canvas/--surface`, semantic `--green/--blue/--red` + wash tints, `--grad` CTA gradient); font stack `'Plus Jakarta Sans Variable'`. Class conventions are BEM-ish with brand prefixes (`hl-*`, `dash-*`, `req-*`, `admin-console__*`, `opt-calendar__*`, `notif-pop*`, `search-pop*`, `chatpanel*`) plus utilities (`.mono`, `.muted`, `.nowrap`, `.eyebrow`). Border-only cards (no shadows). Desktop-first breakpoints at 860/960/1100/900/760/600 px. **No dark mode.** Visual-parity testing (`compare-visual.mjs`, pixelmatch threshold 0) makes class names and rendering effectively a hard contract.

### 3.7 Forms and validation

All validation is hand-rolled pure functions in `src/features/`: `computeRequestDays` (holiday-aware business-day count; half-day = 0.5; optional-holiday single-day rules) + `validateRequest` (field-level errors, e.g. "optional holidays are single-day requests"), `validateSeparation` (future LWD + reason required), `admin/proportionalAnnual` (client mirror of backend proration). `EmployeeEditor` does its own required-field checks. No form library — forms are controlled inputs + `Field` error slots + `aria-invalid`/`aria-describedby`.

### 3.8 Interactive features

- **Notifications**: DB-backed via `GET /notifications` / `PATCH /notifications/read`; unread badge polls every 10 s in Layout; panel opens → fetch + mark-read.
- **Search**: header `SearchPanel` with client filtering for staff, debounced server search for admins.
- **Toast**: single global slot, 3.2 s.
- **Modals/drawers/menus**: `ConfirmModal`, drawer, profile menu — all with Escape/outside dismissal through the shared `useDismiss` hook.
- **Chat panel**: hardcoded demo assistant (no backend), unmistakably flagged as demo.
- **Holiday ticker**: dashboard strip built from `fetchUpcomingHolidays(todayISO())` + picks, formatted by `features/holidays/ticker.ts`.

### 3.9 Error handling and loading states

Class-based top-level `ErrorBoundary`; per-service `{data, error}` contracts with normalized messages and `outcomeUnknown` semantics; per-table `PanelTable` empty slots; pages' loading copy (e.g. "Loading calendar…"); `aria-busy`; retry for transient read failures; AuthContext toasts failed background loads.

### 3.10 Tests

- **Unit**: 60+ suites mirroring `src/` under `tests/unit/` — fully mocked via the `apiClient` mock; page suites lock role-filtered navs, validation error copy, modal arithmetic, bulk-vs-single decisions, reset-token modal content, composer refill behavior; store suites include hardening + write-refresh variants.
- **E2E**: Playwright, `workers:1`, `baseURL: http://localhost:5180`, `webServer: npm run dev -- --port 5180 --strictPort`; auth is **UI login** through `fixtures.ts` `loginAs(page, role)` (`goto('/login')` → fill → `waitForURL('**/dashboard')`); no storageState. Seven specs: smoke redirect, auth fail/success, employee-redirect-away-from-manager-queue, apply-leave full cycle (dates ~60 days out, `[e2e]` reason marker, self-cancel), manager-approval cycle, holidays pick/unpick, separation guard. Visual scripts (`screenshot-visual.mjs`, 1440×900 per role; `compare-visual.mjs` pixelmatch **threshold 0**).
- **Config**: `vitest.setup.ts` (jest-dom), coverage thresholds 70/60/65/70.

**Server-Component hazards detected (full list in §13):** `localStorage` in `apiClient.ts` + `legacyMigration.ts`; `window` CustomEvent auth pub/sub in `auth.ts`; `window.setTimeout` in contexts/hooks; `document.addEventListener` in `useDismiss`; `crypto.getRandomValues` in apiClient; `new Date()`/`toLocaleDateString('en-GB')` in `utils/dates.ts` and formatters.

## 4. Complete Backend Architecture

All paths relative to `backend/api/`. **The backend is out of scope for changes** — this inventory exists so the Next.js frontend can be built against verified facts.

### 4.1 Application initialization (`app/main.py`)

Single module-level `app = FastAPI(title="Leave Portal API")` (no factory pattern). `CORSMiddleware` from `settings.CORS_ORIGINS` (comma-separated; default `http://localhost:5173,http://127.0.0.1:5173`; `.env` adds `:5174` variants), `allow_credentials=True`, methods GET/POST/PUT/DELETE/PATCH, headers `Authorization, Content-Type, traceparent`. Middleware `add_trace_id` echoes the W3C trace-id back as `x-trace-id`. OpenTelemetry initializes **only if** `OTEL_EXPORTER_OTLP_ENDPOINT` is set (TracerProvider `leave-portal-api`, BatchSpanProcessor OTLPSpanExporter insecure, SQLAlchemyInstrumentor + FastAPIInstrumentor). Public endpoints `GET /health`, `GET /health/db` (503 on SQLAlchemyError). Router included with **no prefix** — all paths below are absolute. On startup there are no events; the Docker bootstrap (`app/bootstrap.py run()`) seeds demo data once when the `users` table is empty and `DEMO_PASSWORD` is set.

### 4.2 Endpoints (verified in `app/routes.py`, 1,435 LOC)

**Auth (public/any)**
- `POST /auth/login` — case-insensitive email; 401 "Invalid email or password"; returns `{access_token, token_type:"bearer"}`.
- `POST /auth/logout` — stateless `{ok: true}`.
- `GET /auth/me` + `GET /employees/me` (stacked decorators) → employee payload incl. `manager:{full_name}`; 403 "No employee profile is linked to this account".
- `GET /employees/me/team` → direct reports `[{id, ...}]`.
- `POST /auth/password-reset/{token}` — public; single-use; password ≥ 8.

**Leave requests**
- `GET /leave-requests/mine` — newest-first, joined `leave_types:{name}` + `employees:{full_name,emp_no}`.
- `GET /leave-requests/team` — manager/admin only (403 "Manager access required"); managers see only their direct reports; admins see org; optional `page/page_size` (paged envelope) + `status` filter; absent `page` = legacy full list.
- `POST /leave-requests` (201) — validates active type (404), `days > 0`, `to >= from` (422), half-day single-date + exactly 0.5 (422); `request_no` from sequence `LV-xxxxx`; overlap → 409 "Dates overlap another active request"; post-commit `Notification(kind="request_submitted")` to manager (best-effort).
- `PUT /leave-requests/{request_no}` — owner-only row-locked; only Pending editable (409 "Only pending requests can be edited").
- `POST /leave-requests/{request_no}/cancel` — owner-only, Pending → Cancelled only.
- `POST /leave-requests/{request_no}/decision` — `{decision: "Approved"|"Rejected"}`.
- `POST /leave-requests/bulk-decision` — `{decision, request_nos: 1..100}`.
  - Shared `decide_requests()`: locks rows; 404 missing; **403 "Cannot decide your own leave request"** (even admins); 403 unless `can_decide_for()` (admin OR requester's manager); 409 unless Pending; approve → `update_balance_for_decision()` with policy auto-creation; writes decision notifications. All-or-nothing bulk with rollback. Insufficient balance → 409.
- `GET /leave-requests/team?status=Pending[&page…]` — consumed by admin pages (`fetchOrgRequests`, `fetchPendingRequestsPage`).

**Balances / catalogues / holidays**
- `GET /balances/me` — latest-year row or null.
- `GET /leave-types` — active names.
- `GET /holidays`, `GET /holidays/upcoming?from_date=`, `GET /holidays/picks`, `POST /holidays/picks` (201; advisory lock; cap 3 per country+year → 409 "You can choose only 3 optional holidays per year"; idempotent), `DELETE /holidays/picks/{holiday_id}`.

**Separations**
- `POST /separation-requests` (201) — `{last_working_day, reason (8-value enum), remarks ≤ 800}`. **No decide/review endpoint exists.**

**Admin persona** (all `Depends(require_admin)`; mutations audited via `record_audit()`)
- `POST /admin/employees` (201) — creates User + Employee + prorated balance (or `temporary_password` provided); 409 "Email already registered"; audit `employee_created`.
- `PUT /admin/employees/{employee_id}` — partial edit + role changes with guards: self-role change 403; demoting last admin 409; role change with active direct reports 409; employee-role requires active manager-role manager (422); duplicate email 409; syncs linked `User.email`; audit `employee_updated` with before/after diff.
- `POST /admin/employees/{employee_id}/deactivate` / `/activate` — toggles `User.is_active` (409 "No linked login for this employee"); audited.
- `GET /admin/employees` — paged; filters `search` (ilike full_name/email/emp_no), `role`, `active`, `manager_id`; sort `full_name|doj|emp_no` × `asc/desc`; rows include `is_active` + `manager_name`.
- `GET /admin/audit-logs` — paged; filters `employee_id, action, target_type, target_id, date_from, date_to`.
- `POST /admin/employee-password-resets/{user_id}/init` — active user required; argon2-hashed `token_urlsafe(32)` in `password_reset_tokens`, TTL 60 min; returns one-time plaintext `reset_token` + `reset_endpoint` + `expires_at`; audited.
- `GET /admin/leave-policies` — exposes `app/leave_policy.py` constants (`annual_days_per_year: 22`, `contingency_days_per_year: 10`, `carry_forward_max: 6`, `optional_holidays_max: 3`, `prorated_by: "doj"`, `proration_method: "months_worked_of_12_half_up"`).
- `GET /admin/leave-balances?year=` — paged, default current year, joined employee.
- `PUT /admin/leave-balances/{employee_id}/{year}` — upsert; refuses any field below what is already utilized (422; utilized never writable); audited.
- `GET /admin/requests/stale?before=` — past-dated Pending requests with `_leave_context_evidence()` (`window`, `nearby_approved` ±7-day WFH/Business-Travel neighbors, `holidays` in window).
- `POST /admin/leave-requests/carry-forward` — only `year = date.today().year - 1`; creates next-year balances with `opening_annual = min(max(remaining,0),6)` + prorated credits; advisory lock `carry-forward:{year}`; audited.
- `POST /admin/notifications` — nudge `{recipient_employee_ids ≤ 50, title ≤ 200, body ≤ 800}` → `Notification(kind="admin_nudge")` + audit `nudge_sent`.

**Notifications (any employee)**
- `GET /notifications` — newest-first.
- `PATCH /notifications/read` — stamps all unread with `read_at=now`; returns `{marked, read_at}`; idempotent.

### 4.3 Models (`app/models.py`, 344 LOC)

UUID PKs (`Uuid(as_uuid=False)`, `gen_random_uuid()` server default); native Postgres enums via `enum_type()` helper.

- **User** (`users`): id, email (unique), password_hash, is_active (default true), created_at.
- **Employee** (`employees`): id, user_id (FK users, ON DELETE SET NULL, unique), emp_no (unique, server default `'EM-'||lpad(nextval('emp_no_seq'),5,'0')`), full_name, initials, email (unique), job_title, doj, account, project_name, function_name, **manager_id** (self-FK SET NULL), delivery_partner_name, location, **system_role** enum `employee|manager|admin`, created_at.
- **LeaveType** (`leave_types`): SmallInteger identity id, name unique, is_active.
- **LeaveRequest** (`leave_requests`): BigInteger identity id, request_no unique `'LV-'||lpad(...)`, employee_id FK CASCADE, leave_type_id FK, start_date/end_date, days Numeric(4,1), **mode** enum `Full Day|First Half|Second Half` default 'Full Day', reason, **status** enum `Pending|Approved|Rejected|Cancelled` default 'Pending', approver_id FK, decided_at, requested_on, created_at. Constraints: days>0; span sanity; days within span; **GIST excluded constraint** `leave_requests_no_active_overlap` on `(employee_id, daterange(start_date,end_date,'[]') &&)` WHERE status IN ('Pending','Approved').
- **LeaveBalance** (`leave_balances`): employee_id+year unique; opening_annual, annual_credited, annual_utilized, contingency_credited, contingency_utilized Numeric(5,2) defaults 0; **annual_cap default 22, contingency_cap default 10**.
- **Holiday** (`holidays`): country, location nullable, year, kind check IN ('fixed','optional'), holiday_date, name; unique nulls-not-distinct tuple.
- **OptionalHolidayPick**: composite PK employee_id+holiday_id, picked_at.
- **SeparationRequest** (`separation_requests`): employee_id, last_working_day, reason check IN 8 values, remarks ≤ 800, status enum `Pending|Approved|Rejected`, reviewed_by, decided_at.
- **AuditLog** (`audit_logs`): append-only; actor_user_id/actor_employee_id SET NULL, action, target_type, target_id, detail_json JSONB, request_ip INET, created_at; 3 indexes.
- **PasswordResetToken** (`password_reset_tokens`): user_id CASCADE, token_hash unique, expires_at, used_at, created_by.
- **Notification** (`notifications`): recipient_employee_id CASCADE, kind/title/body, target_type/target_id, read_at, created_at.

### 4.4 Schemas (`app/schemas.py`)

`LoginInput`, `TokenOutput`, `LeaveRequestInput` (**wants camel-adjacent aliases `from`,`to`,`requestedOn`**; `populate_by_name`), `LeaveRequestUpdateInput`, `DecisionInput`, `BulkDecisionInput`, `SeparationInput`, `OptionalPickInput`, `EmployeeOutput`, `EmployeeCreateInput` (`system_role`: employee|manager only; temporary_password ≥8 ≤128), `EmployeeUpdateInput` (system_role may be admin), `EmployeeAdminRowOutput` (+manager_name), `EmployeeCreateOutput{employee, temporary_password}`, `PasswordResetInitOutput`, `PasswordResetPerformInput`, `BalanceUpsertInput`, `CarryForwardInput{year}`, `NudgeInput`, `AuditLogOutput` (+request_ip stringify validator), paged envelopes `{rows, page, page_size, total, page_count}`.

### 4.5 Security and RBAC (`app/security.py`)

JWT HS256; claims `{"sub": user_id, "exp"}`; expiry `ACCESS_TOKEN_MINUTES` (default **720** = 12 h); `JWT_SECRET` with random `token_urlsafe(48)` fallback. `HTTPBearer(auto_error=False)`. Dependency chain: `get_current_user` (decode → active User by sub, else 401 "Authentication required") → `current_employee` (resolve `Employee.user_id == user.id`, else 403) → `require_admin` (`require_admin` 403 "Admin access required"). RBAC is *server-enforced everywhere* — admin dependency on all `/admin/*`, manager gate on `/leave-requests/team`, `can_decide_for`, self-decision ban, self-role-change ban, last-admin protection. Password hashing argon2id.

### 4.6 Business rules (`app/leave_policy.py` + routes)

Single source of truth `leave_policy.py`: constants above; `prorated_annual(doj, year)` (in-year DOJ → `22 × months_worked/12`, half-up 0.5); `deduction_pool(name)` — "Contingency Bucket" → contingency; {"Work From Home","Business Travel","Leave Without Pay","Loss Of Pay"} → none; else annual; `carry_forward_amount(remaining)` = min(max(remaining,0),6). Lifecycle transitions enforced only where implemented (decision endpoints, cancel endpoint) — all-or-nothing with rollback. Optional-pick cap guarded by Postgres advisory lock. `backfill_balances.py` — idempotent policy-computed balance backfill CLI.

### 4.7 Pagination, seeding, migrations, tests, deployment

- `app/pagination.py`: `PageParams` + `page_params` dependency (page ≥1, page_size 1..**100** default 10) + envelope `{rows, page, page_size, total, page_count}`.
- Seeding: `seed.py` requires `DEMO_PASSWORD`; 12 employees (admin `admin@emids.com`, managers `prastina.mary@emids.com`, `sandeep.venkateshkamath@emids.com`, 9 staff); `ORG_DEFAULTS` (account/project/function/partner/location); 12 leave types; ~86 fixed India holidays (Bangalore/Hyderabad/Chennai × 2025/2026) + 20 optional; 3 demo requests; balances computed by policy. All upserts; `bootstrap.run()` seeds only when `users` is empty.
- Alembic: 2 revisions (`33896ade47f9_create_initial_leave_portal_schema` → `f7b21d94c05e_add_admin_persona_tables`); URL from `app.db.settings_DATABASE_URL`; compare_type/compare_server_default on.
- Tests: 22 files / 166 tests; pytest `conftest.py` requires **real Postgres 16** (ephemeral Docker container or `TEST_DATABASE_URL`); truncate-clean between tests; rich factories (`user_factory`, `employee_factory`, `admin_factory`, `auth_headers`).
- Deployment: `backend/compose.yaml` — `db` (postgres:16, `leave_app`/`leave_portal`, 127.0.0.1:5432), `api` (alembic upgrade head + uvicorn, 127.0.0.1:8000), `frontend` (nginx serving the Vite build, 127.0.0.1:5173, `VITE_API_BASE_URL=http://localhost:8000` build arg). CORS allows `5173/5174` dev ports. **A Next.js frontend on a new port will need CORS to accept that origin** (see §13).

### 4.8 Backend functionality that remains completely unchanged

Everything. The migration blueprint requires **zero** Python edits in the default path. The only backend-adjacent touchpoint is *operational*: adding one (or more) allowed origin to `CORS_ORIGINS` — a config/env change, not a code change (§13, §16).

## 5. Application Routes and Role-Based Feature Mapping

Exact current routes from `src/App.tsx` (react-router v6) with their guards, and the Next.js App Router destination.

| # | Current route | Guard | Page component | Next.js structure | Notes |
|---|---|---|---|---|---|
| 1 | `/` | — | `<Navigate to="/login" replace>` | `app/page.tsx` (redirect, or middleware) | Root redirect |
| 2 | `/login` | none | `Login.tsx` (133 LOC) | `app/(auth)/login/page.tsx` | Redirects `isAdmin → /admin` else `/dashboard` |
| 3 | `/dashboard` | `Guard` | `Dashboard.tsx` (147) | `app/(portal)/dashboard/page.tsx` | All roles; ticker + meters + quick actions |
| 4 | `/apply-leave` | `Guard` | `ApplyLeave.tsx` (30, wrapper) → `LeaveRequestForm` | `app/(portal)/apply-leave/page.tsx` | Submit mode |
| 5 | `/leave-details` | `Guard` | `LeaveDetails.tsx` (44) | `app/(portal)/leave-details/page.tsx` | History + inline edit |
| 6 | `/leave-requests` | `ManagerOnly` (`canApprove`) | `LeaveRequests.tsx` (21, wrapper) → `LeaveRequestQueue` | `app/(portal)/leave-requests/page.tsx` | Manager+admin approval queue |
| 7 | `/holidays` | `Guard` | `Holidays.tsx` (140) | `app/(portal)/holidays/page.tsx` | Fixed + optional, pick chips |
| 8 | `/separation-request` | `Guard` | `SeparationRequest.tsx` (124) | `app/(portal)/separation-request/page.tsx` | Submit-only (no review endpoints exist) |
| 9 | `/admin` | `AdminOnly` + AdminProvider | `AdminDashboard.tsx` (467) | `app/(admin)/admin/page.tsx` | KPIs, watchlist, carry-forward |
| 10 | `/admin/employees` | `AdminOnly` | `AdminEmployees.tsx` (202) | `app/(admin)/admin/employees/page.tsx` | CRUD, deactivate, password reset |
| 11 | `/admin/leave-policies` | `AdminOnly` | `AdminLeavePolicies.tsx` (149) | `app/(admin)/admin/leave-policies/page.tsx` | **Actually the balance sheet** (page name is legacy; route name should be preserved for parity) |
| 12 | `/admin/audit-logs` | `AdminOnly` | `AdminAuditLogs.tsx` (96) | `app/(admin)/admin/audit-logs/page.tsx` | Filters + paged table |
| 13 | `/admin/reminders` | `AdminOnly` | `AdminReminders.tsx` (290) | `app/(admin)/admin/reminders/page.tsx` | Manager queue, nudge composer, stale board, pending board |
| 14 | `*` | — | `<Navigate to="/" replace>` | `app/not-found.tsx` + middleware | Catch-all redirect |

Guard translation: `Guard`/`ManagerOnly`/`AdminOnly` become one client `AuthGuard` component used inside each route group's layout (`(portal)/layout.tsx` uses `Guard` semantics, `(admin)/layout.tsx` additionally requires `isAdmin` and mounts `<AdminProvider>`), plus `src/middleware.ts` for cheap early cookie-based redirect of obviously-unauthenticated deep links (see §9.4).

### Feature-to-role mapping (verified implementation status)

| Feature | Status | Frontend pieces | Backend endpoints | Role access |
|---|---|---|---|---|
| Employee dashboard (meters, donut, ticker, quick actions) | **Implemented** | `Dashboard.tsx`, `Donut`, `ticker.ts`, `useHolidayPicks`, `balances.ts` svc | `/balances/me`, `/holidays/upcoming`, `/holidays/picks`, `/employees/me` | all |
| Leave application (incl. half-days, optional holiday picker, overlap errors) | **Implemented** | `ApplyLeave.tsx`, `LeaveRequestForm`, `OptionalHolidayCalendar`, `computeRequest`, `usePickedOptionalHolidays` | `POST /leave-requests`, `GET /leave-types`, `/holidays/picks`, `/balances/me` | all |
| Leave history + edit + cancel | **Implemented** | `LeaveDetails.tsx`, `LeaveRequestHistory`, `ConfirmModal` | `GET /leave-requests/mine`, `PUT /leave-requests/{no}`, `/cancel` | all |
| Manager approval queue + bulk decisions + filter | **Implemented** | `LeaveRequests.tsx`, `LeaveRequestQueue` | `GET /leave-requests/team`, `/decision`, `/bulk-decision` | manager+admin |
| Leave balances view | **Implemented** | `Dashboard.tsx` meters, chunk drawer counts, `mappings.toBalances` | `GET /balances/me` | all |
| Admin dashboard (KPIs, watchlist, carry-forward) | **Implemented** | `AdminDashboard.tsx` | `/admin/*` reads + `POST /admin/leave-requests/carry-forward` | admin |
| Employee management (create/edit/deactivate/search/paginate) | **Implemented** | `AdminEmployees.tsx`, `EmployeeTable`, `EmployeeEditor`, `AdminContext` | `/admin/employees*` (list/create/update/activate/deactivate) | admin |
| Password reset (one-time token handoff) | **Implemented** | `AdminEmployees.tsx` reset modal (shows `reset_token`, `reset_endpoint`, expiry) | `POST /admin/employee-password-resets/{user_id}/init`, `POST /auth/password-reset/{token}` (public) | admin (init) |
| Leave policies page | **Named but is the balance sheet** | `AdminLeavePolicies.tsx` — reads `GET /admin/leave-policies` once (policy text) but the working feature is the balance editor | `/admin/leave-balances*`, `/admin/leave-policies` | admin |
| Audit logs (read-only + filters) | **Implemented** | `AdminAuditLogs.tsx`, `AuditLogTable` | `GET /admin/audit-logs` | admin |
| Stale requests + reminders + nudges | **Implemented** | `AdminReminders.tsx` (3 boards + composer) | `GET /admin/requests/stale`, `GET /leave-requests/team`, `POST /admin/notifications`, `GET /admin/employees` | admin |
| Notifications (badge + panel + mark-read) | **Implemented** | `Layout.tsx` (10 s polling), `NotificationsPanel`, `notifications.ts` | `GET /notifications`, `PATCH /notifications/read` | all |
| Reports/analytics beyond dashboards | **Not found beyond Dashboard/AdminDashboard** — no export/CSV/reporting endpoints | — | — | — |
| Authentication (login/logout/session restore) | **Implemented** (sign-in/up routes) | `Login.tsx`, `AuthContext`, `services/auth.ts` | `/auth/login`, `/auth/me`, `/auth/logout` | public |
| RBAC | **Implemented, dual-layer** | client guards (redirect) + server enforcement (403/401, `require_admin`, `can_decide_for`) | — | — |
| Separation request (submit; no review workflow endpoint) | **Implemented (submit-only)** | `SeparationRequest.tsx`, `validateSeparation` | `POST /separation-requests` | all |
| Chat assistant | **Stub only** | `ChatPanel.tsx` (hardcoded demo responses, flagged "DEMO · RESPONSES DISABLED") | none | all |
| Legacy holiday migration | **Implemented (one-time)** | `legacyMigration.ts`, `data/legacyHolidayData.ts` | `POST /holidays/picks` | all (per employee once) |

---

## 6. API Endpoint and Database Model Mapping

Complete verified HTTP inventory, endpoint ↔ consuming code ↔ backing model.

| Endpoint (FastAPI) | Method | Consumed by (frontend) | Reads/writes models | Role |
|---|---|---|---|---|
| `/health`, `/health/db` | GET | nothing (ops) | — | public |
| `/auth/login` | POST | `services/auth.signInWithPassword`, `Login.tsx` | User (read + last?) / issues JWT | public |
| `/auth/logout` | POST | `services/auth.signOut` | — | any |
| `/auth/me` / `/employees/me` | GET | `employees.fetchMyProfile`, `AuthContext` boot | Employee (+manager join) | any |
| `/employees/me/team` | GET | `employees.fetchTeamIds` | Employee (self-FK) | any |
| `/auth/password-reset/{token}` | POST | **no UI yet** (backend-only; e2e/tests) | User, PasswordResetToken | public |
| `/leave-requests/mine` | GET | `leaveRequests.fetchMine` → AuthContext.mine | LeaveRequest + LeaveType + Employee join | any |
| `/leave-requests/team` | GET | `leaveRequests.fetchTeam`, admin `fetchOrgRequests`/`fetchPendingRequestsPage` | same as above | manager/admin |
| `/leave-requests` | POST | `leaveRequests.insertMine` (via `addMine`) | LeaveRequest (+overlap constraint), Notification (manager) | any |
| `/leave-requests/{request_no}` | PUT | `leaveRequests.updateMine` | LeaveRequest (Pending only) | owner |
| `/leave-requests/{request_no}/cancel` | POST | `leaveRequests.cancelMine` | LeaveRequest status→Cancelled | owner |
| `/leave-requests/{request_no}/decision` | POST | `leaveRequests.decide` (via `decide`) | LeaveRequest→Approved/Rejected, LeaveBalance, AuditLog?, Notifications | approver |
| `/leave-requests/bulk-decision` | POST | `leaveRequests.decideMany` | same | approver |
| `/balances/me` | GET | `balances.fetchMyBalances` → AuthContext.balances | LeaveBalance (latest year) | any |
| `/leave-types` | GET | `leaveTypes.fetchActiveLeaveTypeNames` (names) | LeaveType | any |
| `/holidays` | GET | `holidays.fetchAllHolidays` (`Holidays.tsx`) | Holiday | any |
| `/holidays/upcoming?from_date=` | GET | `holidays.fetchUpcomingHolidays` (Dashboard ticker) | Holiday | any |
| `/holidays/picks` | GET | `holidays.fetchOptionalPicks` | OptionalHolidayPick | any |
| `/holidays/picks` | POST | `holidays.addOptionalPick` (+legacy migration) | OptionalHolidayPick (cap 3, advisory lock) | any |
| `/holidays/picks/{holiday_id}` | DELETE | `holidays.removeOptionalPick` | OptionalHolidayPick | any |
| `/separation-requests` | POST | `separations.createSeparationRequest` | SeparationRequest | any |
| `/notifications` | GET | `notifications.fetchMyNotifications` (Layout 10 s poll; panel) | Notification | any |
| `/notifications/read` | PATCH | `notifications.markAllNotificationsRead` | Notification.read_at | any |
| `/admin/employees` | GET | `admin.fetchAdminEmployees` (AdminContext, SearchPanel, AdminDashboard) | Employee+User(+manager name) | admin |
| `/admin/employees` | POST | `admin.createEmployee` | User+Employee+LeaveBalance, AuditLog | admin |
| `/admin/employees/{id}` | PUT | `admin.updateEmployee` | Employee+User, AuditLog | admin |
| `/admin/employees/{id}/activate` \| `/deactivate` | POST | `admin.setEmployeeActive` | User.is_active, AuditLog | admin |
| `/admin/employee-password-resets/{user_id}/init` | POST | `admin.initPasswordReset` | PasswordResetToken, AuditLog | admin |
| `/admin/leave-policies` | GET | `admin.fetchLeavePolicies` (AdminDashboard, AdminLeavePolicies copy) | constants (no model) | admin |
| `/admin/leave-balances?year=` | GET | `admin.fetchAdminBalances` (AdminLeavePolicies) | LeaveBalance+Employee | admin |
| `/admin/leave-balances/{emp}/{year}` | PUT | `admin.adminUpsertBalance` (modal in AdminLeavePolicies) | LeaveBalance, AuditLog | admin |
| `/admin/audit-logs` | GET | `admin.fetchAuditLogs` (AdminAuditLogs) | AuditLog | admin |
| `/admin/requests/stale?before=` | GET | `admin.fetchStaleRequests` (AdminReminders, AdminDashboard) | LeaveRequest + evidence | admin |
| `/leave-requests/team?status=Pending` | GET | (admin reads above) | LeaveRequest | admin |
| `/admin/notifications` | POST | `admin.adminSendNudge` (composer) | Notification, AuditLog | admin |
| `/admin/leave-requests/carry-forward` | POST | `admin.adminCarryForward` (AdminDashboard) | LeaveBalance (next year), AuditLog | admin |

**Database model coverage summary:** 12 tables (users, employees, leave_types, leave_requests, leave_balances, holidays, optional_holiday_picks, separation_requests, audit_logs, password_reset_tokens, notifications + join for manager naming). All are exercised by the frontend above except: separation review (no endpoint), direct password-reset UI (no page exists — token handoff is copy-out via admin modal), and audit-log writes (backend-generated only; frontend only reads).

---

## 7. Authentication and RBAC Analysis

**Token issuance:** `POST /auth/login` returns a stateless bearer JWT (HS256; `sub = users.id`; `exp = iat + ACCESS_TOKEN_MINUTES`, default 720 min/12 h). There is **no refresh token**, no session table, no logout server-state — `POST /auth/logout` is a courtesy `{ok:true}`.

**Token storage (client):** `localStorage` key `leave-portal-access-token`, managed by `apiClient.ts` (`getAccessToken/setAccessToken/clearAccessToken`). `services/auth.ts` also exposes a bespoke same-window pub/sub (`window` CustomEvent `leave-portal-auth-change`, `subscribeToAuth`/`emitAuthEvent`) used by the legacy `getSession()` path to restore a session without a `/auth/session` endpoint: `AuthContext` tries `/auth/me` with the current token and treats success as signed-in.

**Server-side enforcement (authoritative):** dependency chain `get_current_user → current_employee → require_admin`; 401 "Authentication required"; 403 profiles for manager/admin gates; self-decision ban; self-role-change ban; last-admin demotion block. The client guards (`Guard`, `ManagerOnly`, `AdminOnly`) are **UX-only** — every protected surface fails closed server-side.

**Identity join:** `users.id ↔ employees.user_id` (1:0..1). `AuthContext` stores `meRef = {uid, id}` (employees.id) because many endpoints key on employee identity, not user id. Login resolves `/employees/me` after token acquisition.

**Implications for Next.js:**
1. Tokens in `localStorage` are readable only from Client Components. A Server Component **cannot** attach `Authorization` from localStorage — that is the single most consequential migration constraint (see §9.4).
2. `GET /employees/me` is idempotent and cheap, so the boot-time "who am I" round trip is the natural hydration boundary.
3. RBAC redirect logic can be duplicated at the edge in `src/middleware.ts` only if a cookie mirror of the token exists or we accept it as best-effort only; authoritative RBAC stays in FastAPI either way.
4. The 12-hour expiry with no refresh is convenient: if we add an httpOnly-cookie mirror later (recommended, optional; requires no backend code change since the token itself is unchanged), a failed server-side fetch simply redirects to `/login` — same UX as today.

**SEED/demo accounts (from `seed.py`):** admin `admin@emids.com`, managers `prastina.mary@emids.com` and `sandeep.venkateshkamath@emids.com`, 9 staff accounts; shared password from `DEMO_PASSWORD` (`Portal@2026` in `.env`). Note the Playwright fixtures currently use *different* seeded identities (`sai.nithinreddy@emids.com` manager, `vikram.deshmukh@emids.com` staff) matching the *old Supabase* seed — an existing test-data drift to resolve in Phase 8 (§14, §17).

---

## 8. Current Data Flow

**Boot sequence (signed-in restore)**: `main.tsx` renders → `AuthProvider` effect → `getSession()` (localStorage token probe) → `GET /auth/me`+`GET /employees/me` → set `profile`, `meRef` → `Promise.allSettled([GET /leave-requests/mine, GET /leave-requests/team (role-gated), GET /balances/me, GET /leave-types])` → context state → guard passes → page hydrates from context. Failed background loads toast.

**Sign-in**: `Login.tsx` → `AuthContext.signIn` → `POST /auth/login` → token → storage → auth-change event → `handleSession` (same loads) → redirect by role.

**Typical page flow (e.g. AdminEmployees)**: page (client) → `useAdmin()` → `AdminContext` effect → `fetchAdminEmployees({search, page})` → `apiClient` fetch → `{rows, total, page_count}` envelope → state → `EmployeeTable` (props-in). Pagination/search are **server-driven** (`page`/`page_size`/`search` go over the wire); the admin search debounce lives in the context (300 ms).

**Client-side computational logic (no transport)**: `computeRequestDays` (day count), `toBalances` (meter math), `proportionalAnnual` (proration preview), `findNextHoliday/formatHolidayTicker`, `validateSeparation` — all mirrored pure functions of backend policy; they re-verify against server truth at write time (server errors are normalized into copy).

**Mutation flow**: page → context helper (e.g. `addMine`) → service → `withServiceErrors` (normalize) → `apiRequest` → server → reload affected lists → toast; `outcomeUnknown` semantics for ambiguous failures (`ApiError` with no parsed body).

**Notification loop**: `Layout` mounts → every 10 s `GET /notifications` → unread count → badge; `visibilitychange`/`focus` triggers immediate refresh; opening the panel fetches + `PATCH /notifications/read`.

Key structural fact for migration: **pages do not fetch; contexts fetch; a handful of pages fetch directly** (`Dashboard`, `Holidays`, `SeparationRequest`, `AdminDashboard`, `AdminAuditLogs`, `AdminLeavePolicies`, `AdminReminders`, `SearchPanel`). Server Components can only own data fetching where the token is server-readable (cookie) — otherwise those fetches stay client-side. This drives the §10 classification.

## 9. Proposed Next.js Architecture

### 9.1 Target shape

Next.js **App Router** (route groups `(auth)`, `(portal)`, `(admin)`), React 18/19 client hydration model, TypeScript strict mode carried over. The frontend keeps every existing screen, behavior, class name, and test contract; Next.js contributes routing, layouts, code splitting per route, streaming, and a future-ready server boundary.

### 9.2 The authentication constraint drives the architecture

Bearer-JWT-in-localStorage works only in the browser. A React Server Component (RSC) cannot read it. Rather than redesign auth during this migration, the blueprint adopts a **two-stage strategy**:

**Stage 1 (this migration, zero behavior change):** auth + data fetching remain client-side exactly as they are today. `AuthContext`, `services/*`, and `apiClient.ts` move over *unchanged* (inside a client-only `Providers` component). Pages are client components. Server Components are used for static shells, layout chrome, metadata, fonts — the parts that don't need the token. This is faithful to the constraint "do not change the current authentication system during this analysis phase."

**Stage 2 (optional follow-on, recommended to schedule after the migration settles):** introduce an httpOnly, SameSite=Lax, secure cookie (`lp_token`) written by a Next.js Route Handler at `/login` (it calls FastAPI `POST /auth/login` server-side and mirrors the resulting token into the cookie, still also storing the token for API compatibility if desired). RSCs and `src/middleware.ts` can then read the cookie, forward `Authorization: Bearer <cookie value>` to FastAPI in server-side fetchers, and pre-route-guard at the edge. The FastAPI token format never changes; backend requirements: none (the Authorization header is already supported). CORS may not even matter for server-side calls (no browser → no CORS), though client fetches still need it.

This ordering keeps risk low and lets the enterprise value of RSCs (server-side queries for admin tables, dashboards) be unlocked in a controlled second step.

### 9.3 How existing concepts map

| Existing concept | Next.js home |
|---|---|
| `BrowserRouter` + `<Routes>` | File-system routing (`app/**`) + `useRouter` from `next/navigation` |
| `Guard` / `ManagerOnly` / `AdminOnly` (client redirects) | `(portal)/layout.tsx` + `(admin)/layout.tsx` client `AuthGuard` components (same logic, same redirect targets, same `state.from` via `useSearchParams`); optional `middleware.ts` edge check in Stage 2 |
| `<AuthProvider>` around the tree | `app/providers.tsx` (`'use client'`) containing `AuthProvider` mounted once in the root `layout.tsx` children |
| `<AdminProvider>` inside `AdminOnly` | `(admin)/layout.tsx` mounts it after the guard passes (same as today) |
| Contexts fetching on boot | Unchanged; runs during client hydration |
| Vite env (`import.meta.env.VITE_API_BASE_URL`) | `NEXT_PUBLIC_API_BASE_URL` in `.env.local` via `process.env.NEXT_PUBLIC_API_BASE_URL` (client-inlined like before) |
| `document.title` sync in `Layout` | Per-route `export const metadata` / `generateMetadata` (keep Layout's imperative sync as fallback during parity phase) |
| Page-level `<Navigate>` redirects | `redirect()` from `next/navigation` in server shells, or `<Navigate>` preserved for client guards |
| Vite proxy/dev ports (5173/5174/5180) | `next dev -p 5173` to keep CORS + e2e configs working |
| Vite build/nginx static serving | `next build` + `next start` (or Node server); compose frontend service updated later (deployment phase) |
| React Router `NavLink` active state | Route-aware client nav component (`usePathname`) |
| `ErrorBoundary` around tree | Keep class boundary in providers + `app/error.tsx` + `app/not-found.tsx` |
| `<Toast/>` at app root | Rendered once inside `providers.tsx` |
| Vite `public/` assets & SVGs | `public/` unchanged |
| `@fontsource-variable/plus-jakarta-sans` | Either import as today (client), or — better — `next/font` local variant in `layout.tsx` (optional; visual-parity tests must pass again regardless) |

### 9.4 Data-fetching architecture (Stage 1 default)

- **Browser-side calls** are today's behavior: `services/*` → `apiClient` (`fetch` to `NEXT_PUBLIC_API_BASE_URL`) with `Authorization: Bearer <localStorage token>`. FastAPI must keep this origin in `CORS_ORIGINS` (Next dev on :5173 is already allowed).
- **Server-side calls are deferred** (Stage 2) because localStorage is unreadable in RSC. When enabled: server fetchers (`src/lib/api-server.ts`) read the cookie, forward the Authorization header, use `fetch(..., { cache: 'no-store' })` for auth-relevant reads, and handle 401 by `redirect('/login')`.
- **Caching policy:** nothing may be cached by shared proxies (auth-dependent data) — `no-store` on every server fetch; browser fetches already send no cache directives (verify, add `cache: 'no-store'` to `apiClient` reads to avoid Next/browser surprises).
- **Data refresh:** identical to today (context reload helpers + `usePagedData`/sequence guards). Next's router cache is irrelevant while pages are client components; when pages become RSC (Stage 2), use `router.refresh()` for mutations instead of manual reloads.
- **Loading & error:** preserve `PanelTable` empty/loading slots, `aria-busy`, and page copy; add `loading.tsx` skeletons only if they render byte-identically to existing parity (else skip initially — visual tests are zero-pixel).

### 9.5 CORS

Today's `CORS_ORIGINS` allows `localhost:5173` + `127.0.0.1` (and `:5174` from `.env`). Running Next dev on **5173** keeps this working untouched. Any other port (production domain, e.g. `localhost:3000`) requires an env-only CORS update in the backend deployment — flagged as a deployment task, not a code change. In Stage 2, server-side calls bypass CORS entirely (server-to-server); only the remaining client calls (mutations, token-bearing reads) need the origin listed.

### 9.6 What we deliberately do NOT do

- No backend rewrite, no `/api/*` reprice inside Next as a BFF in Stage 1 (the browser calls FastAPI directly, as today).
- No CSS restyling (zero-pixel visual contract).
- No state-management library introduction (contexts port over as-is).
- No chart-library introduction (Donut SVG ported as-is).

---

## 10. Server Component vs Client Component Classification

Decision rule (Stage 1): **anything that touches auth state, cookies/localStorage, `window`/`document`, or is interactive is a Client Component.** Everything else (static shells, metadata, the `(admin)` and `(portal)` layout chrome structure, `not-found`) is a Server Component.

| Surface | Classification | Reason |
|---|---|---|
| `app/layout.tsx` (root: html, body, providers, Toast) | **Server** + client `Providers` child | Static shell; `<AuthProvider>` must be client |
| `app/providers.tsx` | **Client** (`'use client'`) | Contexts + ErrorBoundary + Toast |
| `(auth)/login/page.tsx` + `LoginForm` | **Client** | Form, signIn, redirects by role |
| Guard-driven layouts `(portal)/layout.tsx`, `(admin)/layout.tsx` | **Server shell** + client `AuthGuard`/role-check component | Guard reads `useAuth()`; shell itself needs no token |
| `Dashboard` (ticker fetch, meters, donut) | **Combination**: server page shell → client sections | Ticker needs the token + `todayISO()` (local date) — keep client (Stage 1); meters depend on context state |
| `ApplyLeave` | **Client** | Form interactivity, `computeRequestDays`, holiday picks context |
| `LeaveDetails` | **Client** | History table + modal edits; data via context |
| `LeaveRequests` (queue) | **Client** | Decisions, filters, bulk actions (manager context) |
| `Holidays` | **Client** | Fetch w/ token, pick toggles, filter state |
| `SeparationRequest` | **Client** | Form + validation + outcomeUnknown handling |
| `AdminDashboard` | **Combination** (Stage 2 candidate for full RSC): today **client** due to 6-parallel-token-fetches + carry-forward mutation | Token-dependent |
| `AdminEmployees` | **Client** (Stage 2 candidate: the *table rows* could be RSC-fed via server fetcher after cookie migration, with client search box) | AdminContext, modals |
| `AdminAuditLogs` | **Client** (Stage 2 candidate for server-side pagination) | `usePagedData` fetches |
| `AdminLeavePolicies` | **Client** (Stage 2 candidate) | Balance edit modal |
| `AdminReminders` | **Client** (Stage 2 candidate) | drei boards + composer |
| `Layout.tsx` (header, drawer, nav, notification badge polling, title sync) | **Client** | Polling, dismissal hooks,NavLink active state |
| `ProfileMenu`, `NotificationsPanel`, `ChatPanel`, `SearchPanel` | **Client** | Dialogs/fetches |
| Feature organisms (`LeaveRequestForm`, `LeaveRequestQueue`, `LeaveRequestHistory`, `EmployeeTable`, `EmployeeEditor`, `AuditLogTable`, `OptionalHolidayCalendar`) | **Client** (all props-in, so they can later be dropped into any RSC parent) | Interactivity |
| UI atoms/molecules (Button…ConfirmModal, PanelTable, Pager, Donut) | **Client** | Interactive/hover/focus logic; `Donut` could stay server (pure SVG) but is imported by client parents — keep `'use client'` for simplicity |
| `middleware.ts` | Edge (server) | Stage 2 only: cheap cookie-presence redirect |

**Anti-pattern to avoid:** slap-marking layouts or pages `"use client"`. Only the smallest interactive units get it; each listed page stays one client file whose JSX structure is identical to today's so the visual contract holds.

---

## 11. Existing-to-Next.js File Mapping

Legend for *Required Changes*: **[R]** reusable without modification · **[P]** partial modification · **[W]** rewrite wrapper · **[D]** destination is new file · **[X]** eventually removable.

### Routing / app shell / config

| Existing file/module | Current responsibility | Next.js destination | Required changes | Risk |
|---|---|---|---|---|
| `index.html` | SPA shell | `app/layout.tsx` (html/body structure) + `public/` | W (by nature; favicon/title carried over) | Low |
| `src/main.tsx` | Boot: providers, CSS imports, font | `app/providers.tsx` + root layout | W | Low |
| `src/App.tsx` | Routes + inline guards | Route groups `app/(portal)/**`, `app/(admin)/**` + `AuthGuard.tsx` | W (route definitions → files; guards → reusable client component) | Medium — highest-density change |
| `src/utils/ErrorBoundary.tsx` | Global boundary | `providers.tsx` + `app/error.tsx` | P (also add error.tsx wrapper) | Low |
| `vite.config.ts` | Dev/test config | `next.config.ts` (subset) + `vitest.config.ts` (tests keep working) | P | Medium |
| `src/vite-env.d.ts` | Vite env types | replace with Next env typing (`next-env.d.ts` + `global.d.ts`) | W | Low |
| `Dockerfile`, `nginx.conf` | Static deploy | Node-based Dockerfile (`next build`/`start`); nginx.conf removed | X/nginx; new Dockerfile | Medium |
| `package.json` | Scripts/deps | new deps: next, remove react-router-dom | P | Low |
| `.env.example` (`VITE_API_BASE_URL`) | Env contract | `.env.example` `NEXT_PUBLIC_API_BASE_URL` | P | Low |

### Authentication / state / services  *(all migrate intact by design)*

| Existing file/module | Current responsibility | Next.js destination | Required changes | Risk |
|---|---|---|---|---|
| `src/store/AuthContext.tsx` | Session + mine/team/balances/leaveTypes + mutations + toast | `src/store/AuthContext.tsx` (unchanged) | R | Low — biggest fan-out file, but pure client code |
| `src/store/AdminContext.tsx` | Admin employee table state | unchanged | R | Low |
| `src/store/mappings.ts` | Row → viewmodel mappers | unchanged | R | Low |
| `src/services/apiClient.ts` | Fetch wrapper + token + traceparent | unchanged | R (localStorage stays; Stage 2 adds cookie awareness) | Low |
| `src/services/retry.ts`, `errors.ts` | Read retry + error normalization | unchanged | R | Low |
| `src/services/auth.ts` | login/me/logout + custom auth event | unchanged (R) | R | Low |
| `src/services/leaveRequests.ts`, `balances.ts`, `holidays.ts`, `leaveTypes.ts`, `employees.ts`, `separations.ts`, `notifications.ts`, `admin.ts`, `legacyMigration.ts` | Endpoint modules | unchanged | R | Low |
| `src/features/**` (computeRequest, rules, ticker, hooks, proportionalAnnual, validateSeparation) | Pure domain logic | unchanged | R | Low |
| `src/hooks/useDismiss.ts`, `useDebouncedValue.ts`, `usePagedData.ts` | Shared hooks | unchanged (`useDismiss` gains `document` guard only if used in server-render pass — it won't be, all callers are client) | R | Low |
| `src/utils/dates.ts`, `format.ts`, `balances.ts`, `roles.ts` | Helpers | unchanged (dates use local time — must only run client-side; today they do) | R | Low |
| `src/constants.ts`, `src/types/**`, `src/data/legacyHolidayData.ts` | Contracts | unchanged | R | Low |
| *(new)* `src/middleware.ts` | Edge pre-guard (Stage 2) | new | D | Low |

### Components (all byte-parity ports)

| Existing file/module | Current responsibility | Next.js destination | Required changes | Risk |
|---|---|---|---|---|
| `src/components/Layout.tsx` | Header/drawer/nav/badge/title | `src/components/layout/AppShell.tsx` (client) mounted by both route groups | P (react-router `NavLink/useNavigate` → `usePathname/useRouter`; keep everything else identical) | Medium |
| `src/components/layout/ProfileMenu.tsx`, `NotificationsPanel.tsx`, `SearchPanel.tsx`, `ChatPanel.tsx` | Header panels | unchanged | P (only router hook imports) | Low |
| `src/components/feature/**` (6 organisms) | Feature sections | unchanged | P (react-router `useNavigate`/`Link` → `useRouter().push`/`next/link` — appears in `LeaveRequestForm` only) | Low |
| `src/components/ui/**` (10 atoms + 3 molecules + barrel) | Design system | unchanged | R | Low |
| `src/components/Icons.tsx` | 20 inline SVGs | unchanged | R | Low |
| `src/pages/*.tsx` (13 files) | Route compositions | `app/(portal|auth|admin)/…/page.tsx` thin wrappers importing the same page bodies, or bodies moved to `src/app-page/`-style modules | P (only module-level `<Navigate to>` and router navigations change) | Low–Medium |
| `src/styles/*.css` (4 files) | Global CSS | imported once in `app/layout.tsx` (same order: global → layout → login → pages) | R | Medium (must prove zero-pixel via visual tests) |
| `@fontsource-variable/plus-jakarta-sans` import | Font | root layout import (identical), optional `next/font/local` later | R | Low–Medium (font loading order affects parity screenshot) |
| `src/assets/*.svg` | Logos | `public/` or `src/assets` imported the same way | R | Low |

### Tests / tooling

| Existing file/module | Current responsibility | Next.js destination | Required changes | Risk |
|---|---|---|---|---|
| `tests/unit/**` (60+ suites) | Behavior lock (mocked apiClient) | unchanged paths; Vitest config split out of Vite config | R (most) / P (any `vi.mock('react-router-dom')` usages — check useHistory/Location mocks; App-level suites that test routing need rewrite) | Medium for App.tsx-centric suites; Low elsewhere |
| `tests/unit/pages/*` | Render pages with providers | pages keep acting as components → suites survive | R | Low |
| `tests/e2e/**` + `playwright.config.ts` | 7 specs, UI-login, base :5180 | unchanged; webServer script changes to `next dev -p 5180` | P | Medium (ports/CORS preserved deliberately) |
| `tests/e2e/screenshot-visual.mjs`, `compare-visual.mjs` | Zero-pixel parity | rerun baselines post-migration | P (regenerate baselines once after confirming byte-parity) | High-value |
| `scripts/seed-users.mjs` | Legacy Supabase seeding | not part of Next migration | X (later) | — |

### Summary counts

- **Reusable unchanged:** store (3), services (10), features (7), hooks (3), utils (5), types (2), constants, data, icons, UI kit (14), CSS (4) — ≈ 47 files (the bulk of the app's logic).
- **Partial modification:** 13 pages + Layout + 4 layout panels + router-import splice in `LeaveRequestForm`; config files.
- **Rewrite-scale:** `App.tsx` (route definitions → app directory), `main.tsx`, `index.html`.
- **Eventually removable:** `main.tsx`, `index.html`, `vite.config` split-out, `nginx.conf`, `src/vite-env.d.ts`, `scripts/seed-users.mjs`, `react-router-dom` dependency.

## 12. Proposed Next.js Folder Structure

Frontend root stays `Leave-managment/emids-leave-portal/frontend/` (same repo location, new toolchain). `src/` keeps its current organization; only routing moves into `app/`. Route groups let `Guard` and `AdminOnly` live as *layout-level* wrappers instead of being repeated on every route.

```
frontend/
├─ next.config.ts                  # port/env parity; strict mode; (optional) rewrites
├─ package.json                    # adds next; drops react-router-dom, vite
├─ playwright.config.ts            # unchanged; webServer -> next dev -p 5180
├─ middleware.ts                   # (Stage 2) edge pre-guard with cookie check
├─ .env.local / .env.example       # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
├─ public/                         # emids-mark.svg, logos (unchanged)
├─ app/
│  ├─ layout.tsx                   # <html>/<body>, font import, CSS imports (4 files, same order)
│  ├─ providers.tsx                # 'use client' — AuthProvider + ErrorBoundary + Toast
│  ├─ error.tsx                    # route-level error UI (calls existing boundary patterns)
│  ├─ not-found.tsx                # replaces <Route path="*"> redirect
│  ├─ page.tsx                     # root redirect -> /login (replicates <Navigate>)
│  ├─ loading.tsx                  # optional; only if byte-stable (else omit in parity phase)
│  ├─ (auth)/
│  │  └─ login/page.tsx            # Login body; public group
│  ├─ (portal)/                    # Guard semantics at layout level
│  │  ├─ layout.tsx                # AuthGuard (signedIn) + <AppShell/> mount
│  │  ├─ dashboard/page.tsx        # dashboard body
│  │  ├─ apply-leave/page.tsx
│  │  ├─ leave-details/page.tsx
│  │  ├─ leave-requests/page.tsx   # ManagerOnly logic inside page body (role gate + redirect to /dashboard)
│  │  ├─ holidays/page.tsx
│  │  └─ separation-request/page.tsx
│  └─ (admin)/                     # AdminOnly semantics at layout level
│     ├─ layout.tsx                # AuthGuard + isAdmin check + <AdminProvider> + <AppShell/>
│     ├─ admin/page.tsx            # /admin dashboard body
│     ├─ admin/employees/page.tsx
│     ├─ admin/leave-policies/page.tsx
│     ├─ admin/audit-logs/page.tsx
│     └─ admin/reminders/page.tsx
├─ src/
│  ├─ components/
│  │  ├─ ui/{atoms,molecules}/     # unchanged
│  │  ├─ layout/                   # AppShell.tsx (renamed Layout), ProfileMenu, NotificationsPanel,
│  │  │                            # SearchPanel, ChatPanel (router hooks swapped)
│  │  ├─ feature/                  # 6 organisms (unchanged)
│  │  └─ Icons.tsx                 # unchanged
│  ├─ guard/SigninGuard.tsx        # client guard components encapsulating Guard/ManagerOnly/AdminOnly
│  ├─ features/                    # unchanged domain logic
│  ├─ hooks/, utils/, constants.ts, types/, data/
│  ├─ services/                    # unchanged (apiClient + 10 modules)
│  ├─ store/                       # AuthContext, AdminContext, mappings (Client contexts)
│  ├─ styles/                      # global.css, layout.css, login.css, pages.css
│  └─ lib/api-server.ts            # (Stage 2) cookie-forwarding server fetcher
├─ tests/
│  ├─ unit/                        # same layout; vitest config split to vitest.config.ts
│  └─ e2e/                         # same specs; visual baselines regenerated once
└─ Dockerfile                      # multistage next build/start (nginx removed)
```

**Decisions explained.** The route groups `(portal)` and `(admin)` exist so the two role layouts can wrap shared chrome exactly once — mirroring today's `Guard`-wraps-`Layout` and `AdminOnly`-wraps-`<AdminProvider>`+`<Layout>` behavior with no duplication. Page bodies deliberately remain in `src/`-style component modules and are imported by thin `page.tsx` files, so the existing `tests/unit/pages/*` suites keep rendering them as ordinary React components. `/leave-requests` keeps its manager check at *page* level rather than group level because it is still one group as far as layout goes. The admin group mounts `AdminProvider` in its layout, preserving today's lifetime semantics (unmounts when leaving admin).

---

## 13. Migration Risks and Solutions

| # | Risk area | Concrete problem in this codebase | Recommended solution | Why it works |
|---|---|---|---|---|
| 1 | React Router → App Router | `App.tsx` holds 14 routes + 3 inline guards + `<Navigate>` fills; `Layout` uses `NavLink`/`useLocation`/`useNavigate`; `SearchPanel` navigates on pick; Login redirects by role | File routes (§12) + a single `SigninGuard` client component + `usePathname/useRouter`; `next/link` replacing `Link` | Mechanical, testable; every navigation has a unit/visual/e2e witness |
| 2 | `import.meta.env` → Next env | Only one var: `VITE_API_BASE_URL` in `apiClient.ts:7` | Rename to `NEXT_PUBLIC_API_BASE_URL`; keep the `|| 'http://localhost:8000'` fallback | Single-var change survives both Vite(test) and Next(run) toolchains if a tiny shim is kept for Vitest |
| 3 | localStorage/browser APIs | `apiClient.ts`, `legacyMigration.ts` (localStorage); `auth.ts` (window CustomEvent); timers in contexts/hooks; `useDismiss` (document); `crypto.getRandomValues` | Keep every one of these files client-only (they are data-layer/interactive); no page body becomes RSC in Stage 1, so nothing executes these on the server | The codebase already isolates browser-only logic — no refactor needed for Stage 1 |
| 4 | Contexts & state management | `AuthContext` is app-wide, `AdminContext` admin-only; both use `window.setTimeout`, refs | Mount `AuthProvider` in `providers.tsx` (client) and `AdminProvider` in the admin group layout — preserving lifecycle | Identical mount/unmount semantics to today |
| 5 | Server/Client boundary | Danger: silent corruption if a context-importing module renders server-side (`useAuth` non-null contract throws) | Enforce with ESLint rule boundaries + a smoke test that renders each route server-side; keep page bodies client | Fails loudly rather than subtly |
| 6 | CSS imports & parity | Four global CSS files assume one global scope; visual tests demand zero-pixel | Import all four in `app/layout.tsx` in the same order in the same file; no CSS modules during parity phase | Same cascade as Vite global import |
| 7 | Third-party browser-dependent libs | Vite plugins; `@fontsource-variable/plus-jakarta-sans` | Font import moves to root layout; test glyph metrics in visual baseline first | `next/font/local` is opt-in later |
| 8 | JWT auth | localStorage token unreadable server-side; 12 h expiry, no refresh | Stage 1 keeps localStorage-only (client components); Stage 2 adds httpOnly cookie mirror + `lib/api-server.ts`; no backend change required either way | Preserves exact auth behavior now; upgrade path exists |
| 9 | FastAPI CORS | Next dev/preview or production origin not in `CORS_ORIGINS`; `allow_credentials=True` requires exact origins | Run Next on **port 5173** in dev; add prod origin via env when deploying (config-only) | Zero backend code change |
| 10 | Direct server-side API requests | None exist yet (Stage 2) — wrong to assume today's fetches port directly to RSC | Client-transient data stays client; only Stage 2 adds server fetchers with `cache: 'no-store'` + 401→`redirect('/login')` | Honors constraint "don't change auth in this phase" |
| 11 | Charts | None (custom SVG) — a fake risk | Port `Donut.tsx` verbatim | Nothing to break |
| 12 | Testing & mocking | Unit suites mock `apiClient` (vi.fn) — layout-agnostic; page suites render pages directly | Keep Vitest (separate config file from `next.config.ts`); page suites unchanged; routing-in-`App.tsx` suites rewritten as e2e or guard component tests | Suites survive because pages stay plain components |
| 13 | Visual baseline | pixelmatch threshold 0 is the strictest constraint | Re-run `screenshot-visual.mjs` after migration; diff before merging; investigate any 1-px engine differences (next/font vs fontsource) | Regression trap turned into a verification harness |
| 14 | Playwright config | `webServer` boots Vite on :5180; fixtures log in through UI | Change the webServer command to `next dev -p 5180`; keep `workers: 1` | e2e behavior preserved |
| 15 | Deployment | `compose.yaml` frontend service is nginx-static | Replace with Node image running `next build/start`; wire `NEXT_PUBLIC_API_BASE_URL` as a **build arg** (client-inline) | Mirrors the existing `VITE_API_BASE_URL` build-arg pattern |
| 16 | Windows dev env | `scripts/run-backend-tests.ps1`, path quirks | No impact — frontend-only migration | — |
| 17 | Stale references | `constants.ts`/`dates.ts` comments claim Supabase; `scripts/seed-users.mjs` is Supabase-specific; Playwright fixtures use old accounts | Note in docs (§17); fix comments opportunistically during touch (not during migration phases) | Avoids scope creep |

---

## 14. Testing Strategy

**Toolchain stays Vitest + Testing Library + Playwright; only the runner wiring changes.**

- **Unit/component** (reuse first): the `tests/unit/**` tree — mocks at `tests/unit/mocks/apiClient.ts` — is transport-independent. Sessions run `build` + `typecheck` + `vitest` as they do now. Reusable unchanged: services (16 suites), store, features, hooks, utils, ui atoms/molecules, feature organisms, layout panels (with router-hook adjustments in the tested component), and most page suites (pages remain plain components). Rewriting needed for: suites that asserted `App.tsx` routing behavior and any `react-router-dom` mock shims.
- **New coverage to add:** a guard-component suite (`SigninGuard` behaviors — signed-out redirect carrying `state.from`, wrong-role redirect to `/dashboard`, `authReady → null`) and minimal `app/layout`/`providers` smoke tests.
- **E2E** (reuse): seven Playwright specs run against the FastAPI backend unchanged; only `webServer` starts Next on the same :5180 port and `SEED_PASSWORD` still applies. Auth tests (`auth.spec.ts`) remain the auth-migration alarm bell.
- **RBAC testing**: unit — guard components; e2e — `apply-leave.spec.ts` covers employee-cannot-see-manager-queue; add an admin-403 smoke spec only if the backend suite (`test_admin_access` — 4 tests) needs a browser-level mirror (optional; server already fails closed).
- **API integration**: unchanged policy — e2e hits the real backend; unit never does.
- **Accessibility**: existing `jsx-a11y` lint + a11y attributes (`aria-*`, roles) port for free; add `@axe-core/playwright` as a cheap optional check (no behavior change).
- **Visual parity**: run `screenshot-visual.mjs` per role (1440×900) pre- and post-migration, `compare-visual.mjs` with threshold 0; regenerate baselines only after confirming the *old* app matches a fresh capture (guards against drifting baselines).
- **Build & TypeScript validation**: `npm run typecheck` (both tsconfigs), `next build` as the new build gate, `npm run lint` with eslint flat config adjusted for `app/**` (new eslint plugin `@next/eslint-plugin-next`).
- **Backend regression**: the 166 backend pytest tests stay green and untouched — proof the migration broke nothing server-side.

## 15. Phased Migration Roadmap

Every phase gates on: unit tests green + typecheck + lint zero errors; visual diff clean (where UI renders); no backend changes.

**Phase 0 — Preparation (read-only commands).**
Objective: dual-tool workspace with zero UI change. Tasks: install Next deps; pick Next 15/16 App Router release; create `next.config.ts`; move tests' Vitest config; add `NEXT_PUBLIC_API_BASE_URL` shim keeping `import.meta.env` working in tests; leave Vite intact (both apps coexist until Phase 9 deletes Vite). Files: `package.json`, `next.config.ts`, `vitest.config.ts`, `tsconfig` adjustments. Risks: version conflicts (none expected — React 18.3 shared). Completion: `npm run test` green under pure-Vitest config; dev servers on both toolchains boot.

**Phase 1 — App shell + providers.**
Objective: Next boots the existing UI from `src/pages` with routing stubs. Files: `app/layout.tsx` (CSS + font in exact order), `app/providers.tsx`, `app/error.tsx`, `app/not-found.tsx`, `src/guard/SigninGuard.tsx`. Testing: providers smoke suite; visual diff on `/login`. Risks: font-loading order shifting metrics (mitigate: import font the same way). Completion: `next dev -p 5173` renders Login pixel-identical.

**Phase 2 — Route migration (portal pages).**
Objective: all 14 routes live. Files: route-group layouts + 13 `page.tsx` wrappers; `Layout.tsx` → `AppShell.tsx` with router hooks swapped; page bodies' navigation calls swapped. Testing: guard suites; e2e smoke + auth specs on :5180. Risks: navigation subtleties (state.from replays, replace semantics). Completion: every route reachable; redirect contract matches §5 exactly.

**Phase 3 — Auth and services integration.**
Objective: sign-in/session flows work through Next exactly as today. Files: none new — `AuthContext`, `services/*`, `apiClient.ts` run unmodified. Tasks: verify localStorage key + 401-clears path; verify boot restore works after hard reload on deep links. Testing: `auth.spec.ts`; e2e hard-reload-and-stay cases. Risks: StrictMode double-effect differences (AuthContext boot effect is idempotent — verify). Completion: full login/restore/sign-out cycle passes e2e.

**Phase 4 — Employee surfaces (Dashboard, ApplyLeave, LeaveDetails, Holidays, SeparationRequest).**
Objective: staff experience migrated and visually identical. Tasks: swap `LeaveRequestForm` router calls; rerun `legacyMigration` behavior once (verify it does not re-run unexpectedly per Next page remounts). Testing: page unit suites + apply-leave e2e + holidays e2e + separation e2e + visual baselines for the 6 staff routes. Risks: optional-holiday migration trigger duplicates (guard via its idempotent design check). Completion: pixel clean, all staff e2e green.

**Phase 5 — Manager surfaces (LeaveRequests queue; Layout badge).**
Objective: approval flows; polling badge counts correct under Next navigation. Testing: queue suites + leave-requests e2e; manual poll-timing check. Completion: approve/reject/bulk/filter e2e green.

**Phase 6 — Admin surfaces (5 pages).**
Objective: admin console at parity. Files: `(admin)/layout.tsx` mounts `AdminProvider` (verify mount/unmount on layout switch); admin pages. Testing: admin page suites + manual (no admin e2e exists today — consider adding a minimal employees-list spec) + visual. Risks: `AdminContext` search debounce + sequence guard interacting with Next re-render loops (unchanged logic; verify). Completion: all five pages pass suites + visual diff.

**Phase 7 — Notifications, search parity, chat panel, ticker.**
Objective: cross-cutting chrome correct. Tasks: 10-s polling under Next (visibilitychange), `document.title` behavior via `metadata` while keeping imperative sync parity, SearchPanel pick navigation, ChatPanel demo escape dismissal. Testing: panels' suites; e2e smoke covers drawer/nav presence. Completion: consistent title/badge behavior.

**Phase 8 — Type/env/build hardening.**
Objective: next build green; env contract stable; strict TS across app dir. Tasks: remove the `import.meta.env` shim; `typecheck` covers `app/**`; eslint Next plugin. Completion: `npm run build` (now `next build`) passes; all suites green.

**Phase 9 — Vite retirement + deployment.**
Objective: single toolchain. Tasks: delete `vite.config.ts`, `index.html`, `src/main.tsx`, `vite-env.d.ts`; remove react-router-dom; regenerate visual baselines; update `compose.yaml` frontend service (Node image; `NEXT_PUBLIC_API_BASE_URL` build arg); CORS env-only note if the origin changes. Testing: full pyramid + visual pack. Completion: repo contains no Vite config; e2e green from compose stack.

**Phase 10 — (Optional, separate effort) Stage 2 server-side auth.**
Objective: RSC unlock. Tasks: login Route Handler (cookie); `lib/api-server.ts`; move AdminAuditLogs / AdminEmployees lists / AdminLeavePolicies table reads into RSC data; `middleware.ts` edge guard. Testing: rerun everything; RBAC e2e. Risks: logout leakage of shared caches (use `no-store`). Completion: cookie-only flows e2e green.

## 16. Dependencies and Configuration Changes

**Added (runtime):** `next` (^15/16 stable chosen in Phase 0). Explicitly **not** added: state libraries, form libraries, chart libraries, CSS frameworks, query libraries — none are needed and their absence is load-bearing for byte-parity.

**Removed (Phase 9):** `react-router-dom`, `vite`, `@vitejs/plugin-react` (replaced by Next transpilers), `nginx.conf`.

**Kept as-is:** React/ReactDOM 18.3.1, fontsource variable font, Playwright, Vitest/RTL/jsdom, eslint stack (add `@next/eslint-plugin-next`), ttypescript configs, pixelmatch/pngjs visual tooling, `scripts/*` backend helpers.

**Config deltas:** `package.json` scripts (`dev:next`, `build:next`, keep Vite scripts until Phase 9); `.env.local`/`.env.example` gain `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`; `tsconfig.json` gains Next plugin paths (`"types": ["next-env.d.ts"]`, moduleResolution "bundler" already); `eslint.config.js` adds Next rules for `app/**`; `playwright.config.ts` `webServer.command` becomes `next dev -p 5180 --strictPort`-equivalent script; `next.config.ts` starts minimal (no rewrites — direct-to-FastAPI browser calls are the Stage 1 design), later gaining `output: standalone` for the Node container; `backend/compose.yaml` frontend service replaced in Phase 9 (infrastructure file, not backend code); the deployment-facing `CORS_ORIGINS` env addition (origin of the Next host) is configuration, not code.

## 17. Unresolved Questions and Assumptions

**Assumptions this blueprint relies on** (all verified from source unless marked otherwise):

1. `localStorage` key naming, `{data,error}` service contracts, toast copy, class names, and the four-CSS global import order are immovable contracts (visual zero-pixel tests). Any desire to restyle during migration must be rejected explicitly — confirmed against `tests/e2e/compare-visual.mjs` threshold 0.
2. The FastAPI backend and its compose stack are unchanged. Only `CORS_ORIGINS` (env) may be extended at deploy time.
3. Auth migration is *not* in scope for this effort ("do not change the current authentication system during this analysis phase" per the request). Stage 2 (httpOnly cookie) is a proposal, not a commitment.
4. The keep-the-unit-tests-working path (pages remain plain components imported by `page.tsx` wrappers) is preferable to inlining pages into `app/**` — trading slight indirection for test continuity.

**Unresolved questions for the product/infra owner:**

1. **Target Next.js/node versions and hosting.** Dev environment allows local pins; production target (VPS via compose? Azure? Vercel?) is unknown and decides `next.config.ts` (`output: 'standalone'`, self-hosted), image strategy, and whether `NEXT_PUBLIC_API_BASE_URL` can be a runtime prop (standalone supports runtime env via `.env.runtime`/`outputEnv`? — simplest is build-arg mirroring the existing `VITE_API_BASE_URL` build-arg pattern).
2. **Expected production origin/port** → the exact CORS entry needed. (If the frontend stays on 5173/5174 origins, zero backend env edits; otherwise add the prod origin.)
3. **Playwright seed-account drift.** `tests/e2e/fixtures.ts` uses `sai.nithinreddy@emids.com` + `vikram.deshmukh@emids.com`, but FastAPI's `seed.py` creates `admin@emids.com`, `prastina.mary@…`, `sandeep.venkateshkamath@…`, and staff like `vikram.deshmukh@…` (staff ✓ matches). Whether e2e manager login passes today against FastAPI seeding should be verified before Phase 3 (it is outside this blueprint's required path but inside Phase 3's gating).
4. **`ChatPanel` survival.** The demo chat assistant is not backend-connected. Keep, stub, or remove during migration? (Blueprint assumes: keep byte-identical; decide later.)
5. **`AdminLeavePolicies` identity confusion.** The route name says policies, but the feature is the balance sheet. Keep the URL (`/admin/leave-policies`) for URL parity (assumed) or rename with a redirect?
6. **Stage 2 priority for admin tables.** Which pages first become RSC when the cookie lands (AdminAuditLogs? AdminEmployees? AdminDashboard?) — deferred per the constraint above.
7. **TypeScript loose ends.** `allowJs` in `tsconfig.json` — confirm whether any legacy `.js` files still need it (Tier-1 migration leftovers); trivial to finalize in Phase 8.
8. **Node version pin** in dev containers/CI; no CI runner configured in this repo — is one being added?

**Items verified non-issues (no action needed):** charts/analytics libraries absent by design; icon library absent (inline SVG `Icons.tsx`); no dark mode; no CSS modules; no i18n framework; no PWA/service worker; no `process.env` usage in app code.

---

## 18. Final Migration Readiness Assessment

**Overall: HIGH readiness for a Category-1 (low-risk) SPA → App Router migration under the Stage-1 strategy described, with organized follow-up (Stage 2) to unlock RSCs' server-side benefits.**

**Strengths that de-risk the effort:**

- The entire data layer (`services/*`, `apiClient.ts`, retry/errors) and domain logic (`features/*`, `utils/*`) is **transport- and router-agnostic** — moving it unchanged is the design center of this blueprint.
- State lives in two contexts with known lifetimes; the admin context is already scoped inside the admin guard exactly as the route-group layout will scope it.
- `tests/unit/**` mocks at the transport seam, so ~90% of suites are layout-agnostic; page bodies remaining plain components keeps them valid.
- The e2e suite is auth-forward (`auth.spec.ts`) and behavior-locked; ports and CORS already align with running Next on :5173.
- Zero-pixel visual tooling exists and will catch any styling or font-loading regression in Phase 1/4/6 gates.
- Backend is fully specified and testable (166 tests) — the migration's blast radius stops at the `frontend/` boundary plus one CORS env value.

**Remaining hard work (Cost, ordered):**

1. `App.tsx` → route files/guards: the densest rewrite (14 routes, 3 guards, redirect contracts, AdminProvider lifetime).
2. `Layout.tsx`/header components: router-hook splice without touching markup.
3. Visual/font loading proving in Phase 1 (parity before anything else).
4. Playwright `webServer` swap + e2e re-baselining.
5. Vite/Next coexistence chore (config splits) in Phase 0 and cleanup in Phase 9.

**Known pre-existing items that are NOT migration blockers but should be scheduled:** stale Supabase references (3 comments + `scripts/seed-users.mjs`); e2e fixtures' seed-account drift (question 3 above); `AdminLeavePolicies` naming confusion; missing UI for password reset page (token handoff is copy-out only).

**Readiness verdict by area:**

| Area | Readiness | Note |
|---|---|---|
| Routing | High | Mechanical; contracts fully enumerated (§5) |
| Components/UI kit | Very high | Byte-parity port, no changes needed |
| State management | Very high | Contexts port unchanged |
| Services/auth | High in Stage 1 (client-only) | Stage 2 needs cookie work + test re-run |
| Data fetching | High in Stage 1 | All client-side already; RSC unlock deferred |
| Styling | High | Global CSS import order + font import; visual harness will police it |
| Testing | High | ~90% reuse; routing suites + e2e webServer only changes |
| Backend | N/A (untouched) | Only an env-only CORS entry at deploy |
| Deployment | Medium | compose frontend service + NEXT_PUBLIC build arg |

**One-sentence conclusion:** the codebase is unusually well-prepared — pure domain layer, mocked transport, contexts scoped to guards, zero-pixel visual tooling — and a disciplined three-week-style execution of Phases 0–9 can move it to the Next.js App Router with no functional or visual regression, while the httpOnly-cookie Stage 2 remains a scoped, low-risk follow-on that finally lets Server Components do server-side reads against the untouched FastAPI backend.
