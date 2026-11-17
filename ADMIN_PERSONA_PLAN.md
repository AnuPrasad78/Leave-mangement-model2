# Admin Persona — Architecture Analysis & Master Prompt

Prepared 2026-10-28 from a full read of this repository (backend, frontend, migrations, tests, seeders, config). Section 4 is the copy-ready master prompt.

---

## 1. Architecture Summary

**Backend** — `backend/api/app/` FastAPI + SQLAlchemy 2.0 typed models + Alembic + PostgreSQL 16.
Backend chain:

```text
routes.py                       → all endpoints (~15 routes, flat module, no sub-routers)
  Depends(current_employee)     → JWT user → linked Employee row (security.py + routes.py:53-63)
  role checks are ad-hoc:       → can_decide_for() (routes.py:89-90), inline 403 in /leave-requests/team
models.py                       → User, Employee (system_role enum incl. 'admin'), LeaveType,
                                  LeaveRequest (GIST no-overlap), LeaveBalance (opening_annual field
                                  exists — natural home for carry-forward), Holiday, OptionalHolidayPick,
                                  SeparationRequest
db.py                           → pydantic-settings (DATABASE_URL, JWT_SECRET, DEMO_PASSWORD), SessionLocal
security.py                     → pwdlib hash/verify, HS256 JWT (sub + exp only — no role claim)
migrations/versions/…           → single baseline revision (33896ade47f9)
tests/conftest.py               → ephemeral Postgres 16 via Docker; employee_factory(role=…), auth_headers;
                                  celebrates real Postgres features (exclusion constraints, advisory locks)
seed.py / seed_data.py          → 11 demo logins, 12 leave types, 109 India holidays, demo balances
```

**Key facts discovered** (these drive the plan):

- **The admin role already exists but has almost no surface.** `SystemRole.ADMIN` is in `models.py:34`, the Postgres `system_role` enum, `ROLES.Admin` in `frontend/src/constants.ts:20`, and `canApprove` (`frontend/src/utils/roles.ts`) and `can_decide_for` (`routes.py:90`) already admit admins. There is **no admin-only endpoint, page, or nav item** anywhere.
- **Admin approvals are silently under-powered.** `/leave-requests/team` (`routes.py:129-136`) returns requests for employees whose `manager_id == admin.id` — an admin would only see their own direct reports, not the org.
- **Annual credit is hardcoded to 18.** `update_balance_for_decision()` (`routes.py:262-266`) lazily creates balances with `annual_credited = 18`, and `annual_cap` defaults to `18`. The requested policy is **22 days prorated by DOJ** — this is a behavior change, not just config.
- **Notifications are client-derived**, in `frontend/src/features/notifications/buildNotifications.ts` — the header bell computes items from session state (`team` rows the store already loaded). There is **no backend notification system** (no table, no API, no email/SMS channel). "Notifications to managers/admins" exists today only as far as team data reaches the approver's session.
- **There is no attendance module anywhere** in the repo (verified by grep). Reviewing past-dated pending requests "against employee attendance" has no backing data model.
- **There is no audit log, no password-reset flow, no employee CRUD endpoint.** Login is the only shared UI surface between personas (`pages/Login.tsx` via `/auth/login`).
- **Authz gap:** admin operations will need a real `require_admin` dependency; today the only admin-specific check is ad-hoc at the decision sites.
- **Frontend conventions** (`frontend/CLAUDE.md`): atomic design (atoms → molecules → organisms → pages), services return `{data, error}` via `withServiceErrors`, business rules in `features/*/` hooks or `utils/`, test-first, protected contracts: App routes, AuthContext, services, CSS classes.
- **Testing**: backend pytest (needs Docker or `backend/api/scripts/run-backend-tests.ps1`), frontend `npm test` (Vitest) / `npm run build` / `npm run lint` / `npm run e2e` (Playwright).

**Overall shape of the work:** role plumbing and approve-surface already exist → the effort concentrates in (a) a `require_admin` dependency + admin API routes, (b) two new tables (audit log, password reset tokens) via Alembic, (c) replacing the hardcoded 18/10 credit with a policy module (22 prorated, cap, carry-forward ≤ 6), (d) an admin dashboard UI sharing the login page and Layout, and (e) tests on both stacks.

---

## 2. File-by-File Change Plan

### Backend — modify

| File | Change |
|---|---|
| `backend/api/app/security.py` | Add `require_admin` dependency: `get_current_user` → load linked `Employee` → 403 unless `system_role == SystemRole.ADMIN`. Reuse `employee_for_user` semantics (currently in `routes.py`). Export a `RoleContext` abstraction only if it stays small. |
| `backend/api/app/routes.py` | ① Change `/leave-requests/team` so admins receive requests for **all** employees (managers keep reports-only). ② `update_balance_for_decision`: suspend the hardcoded `Decimal("18")/Decimal("10")` — call the new `app/leave_policy.py` credits (prorated by `employees.doj`, caps 22/10). ③ Add admin routers/endpoints (see New backend modules below). ④ On admin `Approved/Rejected` of a request, create audit-log entries and (if built) approver notifications. |
| `backend/api/app/models.py` | Add `AuditLog` and `PasswordResetToken` models (see §3 migration). Add nothing to existing models unless a policy decision requires it (`leave_balances.opening_annual` already carries forward). |
| `backend/api/app/schemas.py` | Add `EmployeeCreateInput`, `EmployeeUpdateInput`, `EmployeeAdminOutput`, `PasswordResetInitOutput` (token ID + expiry, NOT the token), `PasswordResetPerformInput`, `BalanceUpsertInput`, `CarryForwardRunInput/Output`, `AuditLogOutput`, `AdminRequestReviewOutput`. |
| `backend/api/app/seed.py` (+ `seed_data.py`) | Add one seeded admin user+employee (`system_role=ADMIN`, email from `seed_data.py`), list it in the seeder printout. Do not touch other rows. |
| `backend/api/tests/conftest.py` | Add an `admin_factory` fixture (thin wrapper over existing `employee_factory(role=SystemRole.ADMIN)`) and, if reset/audit tables land, tiny helpers for them. Factory gains only — do not restructure. |
| `backend/alembic` migrations | New revision on top of `33896ade47f9` (single revision or split into 2 — see master prompt) |

### Backend — new

| File | Purpose |
|---|---|
| `backend/api/app/leave_policy.py` | Single source of truth: `ANNUAL_DAYS_PER_YEAR = 22`, proration helper `prorated_annual(doj, year)` (see open question Q2 on rounding/eligibility window), `CONTINGENCY_DAYS = 10`, `CARRY_FORWARD_MAX = 6`, `OPTIONAL_HOLIDAYS_MAX = 3` (must stay in sync with routes.py:456-457), `carry_forward(prev_remaining)` clamp. Used by routes + carry-forward job + tests. |
| `backend/api/app/audit.py` | `record_audit(session, actor, action, target_type, target_id, detail_json, request_ip)` helper; table-only API for read endpoints. |
| `backend/api/app/notifications.py` | (Q7) Tiny DB-backed notification writer read by a `/notifications` endpoint, OR skip and keep client-derived bell — decided by Q7. |

Admin endpoints (new functions in `routes.py`), all behind `require_admin`, all audited:

```text
POST   /admin/employees                     add employee (+ linked User, hashed temp password, optional manager)
PUT    /admin/employees/{id}
POST   /admin/employees/{id}/deactivate     set users.is_active=false; decide manager reassignment (Q6)
POST   /admin/employees/{id}/activate
POST   /admin/employees/{id}/password-reset-init   → creates PasswordResetToken, returns reset link/ID
GET    /admin/employees                     list (search/pagination)
GET    /admin/leave-policies                read policy config (from leave_policy.py / DB)
PUT    /admin/leave-balances/{employee_id}/{year}   edit credit/opening/cap with validation + audit
GET    /admin/leave-balances?year=          overview of balances org-wide
GET    /admin/requests/stale?before=YYYY-MM-DD     past-dated pending requests + attendance context (Q1)
POST   /admin/leave-requests/carry-forward  year-end job: clamp eligible unused annual ≤ 6 into opening_annual
GET    /admin/audit-logs                    filter by actor/action/date
```

### Database — new migration `migrations/versions/<new>_add_admin_persona.py`

- `password_reset_tokens`: `id (uuid, pk)`, `user_id (fk users.id, ondelete CASCADE)`, `token_hash (text, unique)`, `expires_at (tstz)`, `used_at (tstz null)`, `created_by (fk users.id)`, `created_at`. Index on `(user_id, expires_at)`.
- `audit_logs`: `id bigserial pk`, `actor_user_id (fk users.id, ondelete SET NULL)`, `actor_employee_id (fk employees.id, ondelete SET NULL)`, `action (text)`, `target_type (text)`, `target_id (text)`, `detail_json (jsonb)`, `request_ip (inet null)`, `created_at` + index on `(created_at)` and `actor_user_id`.
- *(If Q7 resolves to DB notifications)* `notifications` table + read endpoint.
- Downgrade drops these tables; existing ones untouched. **No destructive change to any existing table.**

### Frontend — modify

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Add `AdminOnly` guard (mirrors `ManagerOnly` at App.tsx:34-42 but `isAdmin`); mount `/admin`, `/admin/employees`, `/admin/leave-policies`, `/admin/audit-logs` under a new `features/admin` layout shell sharing `<Layout>` per CLAUDE.md page rules. |
| `frontend/src/components/Layout.tsx` | Add admin schema nav items 7+ (Employees, Leave Policies, Dashboard(sub), Audit Logs) filtered by `isAdmin`; keep the 6 existing items untouched. `NAV` becomes three MVP-level excerpts with a role filter (atomic rule: presentation only). |
| `frontend/src/utils/roles.ts` | Add `isAdmin(profile)`. Keep `canApprove` unchanged (already admits admin). |
| `frontend/src/store/AuthContext.tsx` | Extend value with admin loaders **only** (`loadAdminEmployees` etc.) or add a separate `AdminContext` provider — prefer a separate `AdminContext` to avoid re-growing the mega-context (already 315 lines with 3 hardening tests). |
| `frontend/src/services/apiClient.ts` | No change expected (tokens are already role-agnostic). |
| `frontend/src/pages/Login.tsx` | **No change to behavior** — shared login. Optional: after sign-in redirect admins to `/admin` when `profile.system_role === ROLES.Admin` (Q3). |
| `frontend/src/styles/pages.css` | New admin page classes only; no edits to existing selectors/classes (CLAUDE.md visual contract). |
| `frontend/scripts/seed-users.mjs` | Optional: add the admin login to the frontend demo seed list if that script re-lists users. |

### Frontend — new

| File | Purpose |
|---|---|
| `frontend/src/services/admin.ts` | `{data,error}` wrappers for every admin endpoint, using `apiRequest` + `withServiceErrors`. |
| `frontend/src/types/models.ts` | Add row types mirroring admin schemas. |
| `frontend/src/features/admin/proportionalAnnual.ts` | Pure function mirroring `leave_policy.prorated_annual` (display-only; backend remains authoritative). Unit-testable without server. |
| `frontend/src/features/admin/useAdminEmployees.ts` | Hook owning list/edit/deactivate/reset-init flows via `services/admin.ts`. |
| `frontend/src/components/feature/admin/AdminNav.tsx`, `AdminDashboardOverview.tsx`, `EmployeeTable.tsx`, `EmployeeEditor.tsx`, `AuditLogTable.tsx` | Atomic-design organisms/molecules; atoms reused from `components/ui`. |
| `frontend/src/pages/AdminDashboard.tsx`, `AdminEmployees.tsx`, `AdminLeavePolicies.tsx`, `AdminAuditLogs.tsx` | Route-level pages composing the organisms. |
| `frontend/tests/unit/services/admin.test.ts` | `{data,error}` contract tests per existing services tests. |
| `frontend/tests/unit/features/admin/proportionalAnnual.test.ts` | Proration rounding table driven by the same cases the backend tests use. |
| `frontend/tests/unit/pages/Admin*.test.tsx`, `frontend/tests/unit/store/AdminContext.test.tsx` | Render/interaction tests. |
| `frontend/tests/e2e/admin.spec.ts` | Playwright flow: admin sign-in → dashboard → add employee → reset init → audit trail appears; plus regression that employee/manager flows are unchanged. |

### Backend — new tests

| File | Covers |
|---|---|
| `backend/api/tests/test_admin_access.py` | 403/200 role gating on every `/admin/*` route; regular employee cannot read admin data; manager cannot either. |
| `backend/api/tests/test_admin_employees.py` | Add/edit/deactivate/activate; duplicates rejected (email unique); deactivation blocks login but preserves history. |
| `backend/api/tests/test_admin_password_reset.py` | Init → token stored hashed, expires, single-use; perform → old password invalid, new works; inactive user cannot reset. |
| `backend/api/tests/test_leave_policy.py` | Proration table (full year, mid-year DOJ, year-1); caps 22/10; carry-forward clamp at 6 (5→6, 7→6, 0→0); over-credit guard. |
| `backend/api/tests/test_admin_balances.py` | Manual upsert + audit entries. |
| `backend/api/tests/test_admin_stale_requests.py` | Past-dated pending list + decision flow creates audit rows. |
| `backend/api/tests/test_audit.py` | Mutations append rows; list endpoint filtering. |
| `backend/api/tests/test_team_requests_admin.py` | Admin sees org-wide; manager still reports-only. |

---

## 3. Missing Functionality, Risks & Unresolved Policy Decisions

**Missing functionality (blocks, not in repo today):**

1. **No attendance domain.** No table, model, endpoint, or UI references attendance anywhere. The requirement "review past-dated pending requests against employee attendance" cannot be implemented as stated. The Admin review screen needs a definition of "attendance evidence" — candidates: the employee's approved `Work From Home` / `Business Travel` requests in the same window, holidays in range, or a new `attendance_records` table that nothing currently populates. **Q1 below.**
2. **No password-reset channel.** No email/SMS anything. A reset flow must decide delivery (Q4).
3. **No backend notification system.** The bell is pure client-side derivation. "Notify managers/admins for approval/rejection" on stale requests has no transport (Q7).
4. **No employee CRUD**, no admin balance editing, no audit logging, no admin UI — all net-new.

**Risks:**

- `update_balance_for_decision()` credits balances lazily on first approval; changing credited 18 → prorated 22 changes existing demo data meaning. Needs one-time reconciliation or explicit policy for already-credited years (Q2d).
- `leave_balances.opening_annual` already exists and is included in `remaining` math (`opening_annual + annual_credited − annual_utilized`), so carry-forward fits without schema change — but no job/helper computes it anywhere yet.
- Alembic baseline is the only revision; adding tables is safe, but test conftest runs real migrations (good — nothing to bypass).
- Two sources of truth if frontend reimplements proration — keep frontend copy display-only.
- `AuthContext` is already large and has three dedicated hardening test files; bolting admin loading into it risks regressions — hence a separate admin context/store.

**Unresolved policy decisions (one "Q" per master prompt):**

- **Q1** — What counts as "attendance evidence" for stale-request review? (approve-and-wait / new table / use WFH+travel requests as proxy)
- **Q2** — Proration of 22 annual days by DOJ: how to prorate (Q2a calendar-days fraction vs full/partial completed months), what rounding (half days 0.5 grid vs round-half-up to whole; Decimal(5,2) column supports halves), what eligibility rule (e.g. DOJ before/after Jul 1 gets full year vs prorated fraction), whether contingency 10 is ever prorated, and what to do for years already credited at 18 (reconcile or grandfather).
- **Q3** — Should admins land on `/admin` (org dashboard) or the shared Dashboard after login as default?
- **Q4** — Password reset delivery: rendered reset link in the admin UI (copy + paste, works offline, today) vs a real email service (out of current scope) vs both, with which link TTL and reuse rules?
- **Q5** — On employee deactivation: block login only (`users.is_active=false`) or also `employees` row; who takes over the deactivated person's reports (Q6a) and in-flight pending requests (Q6b)?
- **Q6** — same as Q5 sub-questions (see above).
- **Q7** — Approver notifications for stale pending requests: write a `notifications` DB table + `/notifications` read endpoint (small, future-proof) or keep client-derived bell only (zero new backend surface)?
- **Q8** — Is a **yearly carry-forward job** (admin-triggered or scheduled? run once per year) correct, or is it a per-employee/admin manual action plus what happens when run late?
- **Q9** — Are the three "fixed optional holidays" per employee the existing 3-picks mechanism (already enforced), or is the requirement instead a static per-year list of exactly 3 optional holidays set by admin (replacing personal picks)?

---

## 4. Copy-Ready Master Prompt for Claude Code

Copy everything below this line into Claude Code.

---

**MASTER PROMPT — Add the Admin persona to the emids Leave Portal**

You are working in the repository rooted at this folder (`backend/api/` + `frontend/`). Your job is to add a third persona — **Admin** — on top of the existing FastAPI + Alembic + Postgres backend and React 19 + Vite frontend, without breaking Employee or Manager functionality.

**Ground rules (read first!)**

1. Read before writing: `backend/api/app/routes.py`, `models.py`, `schemas.py`, `security.py`, `db.py`, `seed.py`, `migrations/versions/33896ade47f9_create_initial_leave_portal_schema.py`, `backend/api/tests/conftest.py`, `frontend/CLAUDE.md`, `frontend/src/App.tsx`, `frontend/src/store/AuthContext.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/utils/roles.ts`, `frontend/src/constants.ts`, `frontend/src/services/error.ts` and `frontend/src/services/apiClient.ts`. Follow `frontend/CLAUDE.md` atomically (molecules, test-first, protected routes/services/CSS contracts).
2. **Do not rename, move, or rewrite existing files.** Work additively. Existing Employee and Manager behavior and tests must pass unchanged — run `cd frontend && npm test && npm run build && npm run lint` and the backend suite (PowerShell: `powershell -ExecutionPolicy Bypass -File backend\api\scripts\run-backend-tests.ps1`; or export `TEST_DATABASE_URL`) after every meaningful step.
3. Identity/platform facts you must honor (do not re-invent): `SystemRole.ADMIN` already exists in `backend/api/app/models.py` (enum `system_role`, values employee|manager|admin) and in `frontend/src/constants.ts` (`ROLES.Admin`); `canApprove` in `frontend/src/utils/roles.ts` and `can_decide_for` in `routes.py` already admit admins. `/leave-requests/team` currently returns only employees whose `manager_id` equals the caller, so admins must be widened to org-wide. Balance crediting is hardcoded in `update_balance_for_decision()` (`routes.py`) as 18 annual / 10 contingency.
4. Implement in the numbered phases below, each one as its own commit-sized change with its tests green before moving on. If a phase depends on an **unresolved decision (Q1–Q9)**, stop, ask the question, and record the answer in a `ADMIN_DECISIONS.md` file at the repo root before continuing.
5. Never run `docker compose down -v` or touch the dev database; backend tests use an ephemeral Postgres 16 container via `tests/conftest.py`.

**Phase 1 — Policy module + role gate**

- Create `backend/api/app/leave_policy.py`: constants `ANNUAL_DAYS_PER_YEAR = 22`, `CONTINGENCY_DAYS_PER_YEAR = 10`, `CARRY_FORWARD_MAX = 6`, `OPTIONAL_HOLIDAYS_MAX = 3` (must equal the value checked in `add_pick` in `routes.py` — refactor that route to read this constant), and `def prorated_annual(doj, year)`.
- Proration semantics **(Q2 — ask, then implement per answer)**: prorate by months worked in `year` (full calendar fraction vs 6/12 shift decided in Q2a), round to the 0.5-day grid supported by `Numeric(5,2)`, and return at least 0 and at most 22. Also export a constant for the proration method chosen so it can be serialized into audit rows.
- In `routes.py`, replace **both** hardcoded `Decimal("18")` and `Decimal("10")` in `update_balance_for_decision()` with calls into `leave_policy` (prorated credit for annual; flat 10 for contingency). Existing demo-year rows keep whatever they contain **(Q2d — ask whether to reconcile or grandfather)**.
- In `security.py`, add `require_admin` (a FastAPI dependency chain on `get_current_user` → load Employee by `user_id` → 403 unless `system_role == SystemRole.ADMIN`).
- Tests: `backend/api/tests/test_leave_policy.py` — table-driven proration (full year, mid-year DOJ, year-1, 0-worked, rounding to 0.5), plus a test that `update_balance_for_decision` now credits prorated values at the caps 22/10.

**Phase 2 — Fix admin visibility + seed an admin**

- `routes.py /leave-requests/team`: if caller is admin, return requests for **all** employees, paginated by `limit`/`offset` query (default 100); managers keep reports-only. Same shape as today.
- Add a dedicated seeded admin to `backend/api/app/seed_data.py` (e.g. `admin@emids.com`, `system_role=ADMIN`) and wire it into `seed.py` exactly like existing profiles (same `DEMO_PASSWORD` hashing).
- Tests: `test_team_requests_admin.py` (admin sees org-wide; manager does not) and seeder idempotency for the admin login.

**Phase 3 — Employee management API**

- `backend/api/app/audit.py`: `record_audit(session, actor, action, target_type, target_id, detail_json, request_ip)` writing into a new `audit_logs` table defined in `models.py` (`actor_user_id`, `actor_employee_id`, `action`, `target_type`, `target_id`, `detail_json JSONB`, `request_ip`, `created_at`). **Never mutate/rewrite rows — append-only.**
- Alembic revision (single new head on top of `33896ade47f9`): `audit_logs` table + all Phase-3/4 tables (surge-y but keeps heads at 1).
- New admin endpoints in `routes.py` (all `Depends(require_admin)`, all audited, all returning Pydantic schemas defined in `schemas.py`):
  - `POST /admin/employees` — creates a `User` (hashed temporary password from a provided value; server generates one if absent, returned **once** in the response) and the linked `Employee`; email/`emp_no` uniqueness enforced; `system_role` restricted to EMPLOYEE or MANAGER for this route (use a second call to demote/promote roles if Q10 needed).
  - `PUT /admin/employees/{id}` — edit profile fields (`full_name`, `initials`, `job_title`, `doj`, `account`, `project_name`, `function_name`, `manager_id`, `delivery_partner_name`, `location`, `email`).
  - `POST /admin/employees/{id}/deactivate` — sets `users.is_active=False` (blocks login at the existing `verify_password`/`is_active` path in `/auth/login`, routes.py 43-45). **Do NOT cascade-delete anything.** Logout also clears existing tokens on next request because `get_current_user` already rechecks `is_active`.
  - `POST /admin/employees/{id}/activate` — reverse. Report-reattachment is a separate field on the DTO (Q6 — ask which manager takes over deactivated employees' reports, and who handles their in-flight PENDING requests).
  - `GET /admin/employees` — paged list with `search` filter (name/email/emp_no).
- Also add `GET /admin/audit-logs` (filter by actor, action, date range, paged).
- Tests: `test_admin_access.py` (role gates on every `/admin/*` route — employee and manager callers must 403), `test_admin_employees.py` (CRUD, uniqueness, deactivation blocks login but preserves history), `test_audit.py`.

**Phase 4 — Password reset**

- `models.py`: `PasswordResetToken` (`user_id FK users.id CASCADE`, `token_hash TEXT UNIQUE`, `expires_at`, `used_at`, `created_by`, `created_at`).
- Alembic revision (or merged with Phase 3's) adds the table.
- Endpoints (both `Depends(require_admin)`, audited):
  - `POST /admin/employee-password-resets/{user_id}/init` → creates token: `secrets.token_urlsafe(32)` hashed with `pwdlib` before storage; plaintext returned **once** in the response as a reset URL (see Q4); TTL from `settings.PASSWORD_RESET_TTL_MINUTES` (default 60).
  - `POST /auth/password-reset/{token}` — **public**, sets new password (validates complexity/policy as in `Q4`), marks token used, then deactivates all other live tokens for the user. Works even when `users.is_active=False` only if `Q4b` says so (blocked by default).
- Reuse `password_hash = PasswordHash.recommended()` from `security.py` for both stored hash of the token and the new password.
- Tests: `test_admin_password_reset.py` — expiry, single-use, reused-token 400, token hashed at rest, old password invalidated, new one works, inactive-user behavior per `Q4b`.

**Phase 5 — Balances & policy viewing/editing**

- Endpoints (`Depends(require_admin)`, audited):
  - `GET /admin/leave-policies` — serializes current `leave_policy.py` values + proration method (read-only).
  - `GET /admin/leave-balances?year=` — org-wide view; reuse the row shape from `/balances/me`.
  - `PUT /admin/leave-balances/{employee_id}/{year}` — admin-authored adjustments only to `annual_credited`, `contingency_credited`, `opening_annual`, `annual_cap`, `contingency_cap`; must **never** write below `annual_utilized` / `contingency_utilized` (422 if it would). Audit every change with a JSONB diff.
- Tests: `test_admin_balances.py`.

**Phase 6 — Stale pending review + notifications**

- `GET /admin/requests/stale?before=DATE` — pending requests whose `end_date < before` (past-dated), joined with the (Q-chosen) "attendance evidence" **(Q1 — ask). Default fallback if att-as-table is refused: use the employee's overlapping approved `Work From Home` / `Business Travel` requests plus the fixed/optional holiday rows in the window as read-only context.
- Admin can approve/reject these via the existing `/leave-requests/{request_no}/decision` and `/leave-requests/bulk-decision` routes (admin is already allowed by `can_decide_for`).
- Approver notification **(Q7 — ask)**: if the answer is "DB-backed notifications", add a `notifications` table + `/notifications` read endpoint and have the decision routes (`decide_requests` in routes.py) and the stale-review flow insert a row for the employee's manager (and the admin actor). If the answer is "client-side only", document the outcome in `ADMIN_DECISIONS.md` and do not build the table.

**Phase 7 — Carry-forward**

- `POST /admin/leave-requests/carry-forward` body `{"year": N}` (idempotent; refuses if `year != current_year - 1` — **Q8 — ask** whether to allow catch-up years): for each active employee with a balance for `year`, compute `remaining = opening_annual + annual_credited − annual_utilized`, set the **next** year's `opening_annual = min(remaining, CARRY_FORWARD_MAX)` (create the next-year row if missing, prorated credit per Phase-1's `prorated_annual` for employees whose DOJ falls in that year). Guard the whole job in advisory-lock style (`pg_advisory_xact_lock`) like `add_pick` already does. Idempotent → the second run in the same year is a no-op unless a balance changed.
- Everything is audited (batch record via one `action='carry_forward'` row with per-employee detail in `detail_json`).
- Tests: extend `test_leave_policy.py` with clamp/rollover edge cases: remaining 5 → 6, 7 → 6, 0 → 0; employee with no annual balance; employee whose unused is entirely contingency (never carries).

**Phase 8 — Frontend admin UI**

- Follow `frontend/CLAUDE.md` atomically — no Supabase calls anywhere (apiClient today is pure fetch; keep it that way), business rules in feature hooks, services return `{data, error}`.
- Add `frontend/src/services/admin.ts` wrapping every `/admin/*` route with `apiRequest` + `withServiceErrors`.
- Add a **separate** `frontend/src/store/AdminContext.tsx` (do not grow the 315-line `AuthContext`, which has 3 dedicated hardening test files — write them if you must touch `AuthContext`).
- `frontend/src/App.tsx`: add `AdminOnly` guard (mirror the pattern at lines 34-42; use `isAdmin` below) and routes `/admin`, `/admin/employees`, `/admin/leave-policies`, `/admin/audit-logs` (and `/admin/requests-stale` if Phase 6 was built).
- `frontend/src/utils/roles.ts`: add `isAdmin(profile)`; **leave `canApprove` unchanged** (it already admits admins).
- `frontend/src/components/Layout.tsx`: extend `NAV` with admin items (Employees, Policies, Dashboard, Audit Logs) each tagged for `admin` role only so the visible filter stays presentation-only; do not reorder or restyle existing items.
- `frontend/src/pages/Login.tsx`: shared login as-is. Optional single change — after successful sign-in, if `profile.system_role === ROLES.Admin`, navigate to `/admin` **(Q3 — ask)**.
- New pages `frontend/src/pages/AdminDashboard.tsx`, `AdminEmployees.tsx`, `AdminLeavePolicies.tsx`, `AdminAuditLogs.tsx` plus organisms/molecules under `frontend/src/components/feature/admin/` (`AdminNav`, `EmployeeTable`, `EmployeeEditor`, `AuditLogTable`) composing existing atoms from `frontend/src/components/ui`.
- New pure helper `frontend/src/features/admin/proportionalAnnual.ts` mirrors `leave_policy.prorated_annual` for display only; show clearly that the **backend owns authority** (label computed values "estimate" if they can differ).
- `frontend/src/styles/pages.css`: add new classes; **do not** edit any existing selector (visual contract).
- Optional in `frontend/scripts/seed-users.mjs`: append the admin login from `backend/api/app/seed_data.py` so the demo seed lists all roles.

**Phase 9 — Tests, verification, and handoff report**

- Backend: `backend/api/tests/test_admin_access.py`, `test_admin_employees.py`, `test_admin_password_reset.py`, `test_admin_balances.py`, `test_admin_stale_requests.py`, `test_team_requests_admin.py`, `test_audit.py`, `test_leave_policy.py` (Phase-1 file). All integration markers, using the factories/`auth_headers` pattern already in `tests/conftest.py` (add an `admin_factory` as a thin wrapper, do not restructure).
- Frontend: `tests/unit/services/admin.test.ts`, `tests/unit/features/admin/proportionalAnnual.test.ts`, unit tests for each new page and AdminContext, and `tests/e2e/admin.spec.ts` covering admin sign-in → add employee → reset-init → deactivate → audit trail appears; plus a regression spec asserting existing employee/manager flows still work.
- Run, in order, from `frontend/`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e -- --headed` if interactive changes landed. Backend: `powershell -ExecutionPolicy Bypass -File backend\api\scripts\run-backend-tests.ps1`.
- Final response, as required by `frontend/CLAUDE.md`: files changed with their component boundaries, tests added/updated, behavior preserved vs intentionally changed, validation command outputs, and remaining risks — plus the final decisions recorded in `ADMIN_DECISIONS.md` for every Q still open.

---

*Document generated from code as of 2026-10-28 — line numbers may drift as the project evolves.*
