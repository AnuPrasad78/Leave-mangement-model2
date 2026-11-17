# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout (nested)

- `Leave-managment\emids-leave-portal\frontend\` — **the frontend app** (npm project root; all npm commands run from here).
- `Leave-managment\emids-leave-portal\backend\` — the FastAPI application (`backend\api`: app/, alembic, tests) plus `backend\compose.yaml` (postgres:16 + api + frontend containers). Start dev infra with `docker compose up -d db api` from `backend\` (Docker lives inside WSL on this machine: `wsl -e sh -c "cd /mnt/c/.../backend && docker compose up -d db api"`).
- `.claude\skills\` — executable workflows for this repo (running the app, testing, supabase-setup legacy).
- Claude sessions often start one folder **above** this repo root (an outer non-git folder that also holds a `.claude/launch.json` for the desktop preview) — paths seen there may contain this repo as a subfolder.

## Project

Next.js App Router portal ("emids-leave-portal") on React 19, TypeScript strict mode (`npm run typecheck`), talking to the FastAPI backend (`backend\api`) on PostgreSQL (compose stack). The frontend was migrated from Vite (2026-11) and restructured into an App Router + atomic-design layout (2026-11).

**Frontend architecture** (paths relative to `frontend\`):

- Routing lives entirely in `app\` — route groups `(auth)`, `(employee)`, `(manager)`, `(admin)` plus `SigninGuard` (`app\lib\security\SigninGuard.tsx`). URLs: `/login`, `/dashboard`, `/apply-leave`, `/leave-details`, `/holidays`, `/separation-request`, `/leave-requests`, `/admin`, `/admin/employees`, `/admin/leave-policies`, `/admin/audit-logs`, `/admin/reminders`, `/` → `/login`, wildcard → `/` → `/login`.
- Each page lives at its route as a thin server `page.tsx` that renders a route-local template from that route's `_components\` folder (e.g. `app\(employee)\dashboard\_components\DashboardTemplate.tsx`). Client boundaries start at the templates/components — remember `'use client'` when adding new ones.
- Shared UI follows atomic design under `app\components\`: `atoms\` (Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, WarnBanner, NavLink, Icons), `molecules\` (ConfirmModal, PanelTable, Pager), `organisms\` (Layout shell + ProfileMenu/NotificationsPanel/SearchPanel/ChatPanel + LeaveRequestForm incl. OptionalHolidayCalendar), `templates\` (ErrorBoundary). The barrel `app\components\index.ts` re-exports atoms/molecules.
- Route-exclusive components live in that route's `_components\`: the manager queue organism in `app\(manager)\leave-requests\_components\`, leave history in `app\(employee)\leave-details\_components\`, admin tables in `app\(admin)\admin\employees|audit-logs\_components\`.
- Infrastructure sits at the frontend root: `services\` (apiClient.ts + one module per API area, `axios`-free fetch seam; `app\lib\assets.ts` handles svg import differences), `store\` (AuthContext.tsx, AdminContext.tsx, mappings.ts), `hooks\`, `types\`, `utils\`, `constants\index.ts`. Pure domain rules live in `app\lib\validation\` (computeRequest, validateSeparation, proportionalAnnual) and `app\lib\utils\` (balanceRules, ticker); legacy holiday seed data in `app\lib\legacyHolidayData.ts`.
- Auth is an HttpOnly session cookie (`leave_portal_session` — set by `/auth/login`, cleared by `/auth/logout`); `services\apiClient.ts` sends `credentials: 'include'` and never stores or reads the JWT; RBAC is FastAPI-authoritative; frontend guards are UX-only.

**Testing** (`npm test` unit under `tests\unit\`, `npm run e2e` Playwright against the compose FastAPI via `next dev` on :5180): unit tests are fully mocked at the `apiClient` seam; navigation is asserted via `tests\unit\router-mocks.ts` (`navMocks`). Playwright webServer boots `next dev` itself; mutating specs clean up via API. Visual parity uses `tests\e2e\screenshot-visual.mjs` + `compare-visual.mjs` (threshold 0) — baselines live in `tests\.visual-baseline\.visual-after` (gitignored). **No `src\` directory exists anymore**; `src\pages\` was dissolved into `_components\` (the old `pages\.gitkeep` Pages-Router anchor was removed with it).

## Commands

Run inside the frontend folder (or use `npm --prefix <frontend-folder>`):

```bash
npm run dev        # next dev (Turbopack), http://localhost:3000
npm run build      # next build (standalone output)
npm run start      # next start (production server)
npm test           # vitest run — unit suites, fully mocked at the apiClient seam
npm run test:watch
npm run e2e        # playwright — real FastAPI via compose + next dev on :5180 (webServer boots it)
npm run lint       # eslint . (flat config, 0 errors expected)
npm run format     # prettier --write app services store hooks types utils constants tests
```

- Env config is `frontend\.env` (gitignored) with `NEXT_PUBLIC_API_BASE_URL` (browser-bundled). **Restart the dev server after changing it**. Never put server secrets in a `NEXT_PUBLIC_` variable.

## Atomic design classification

Classification is by responsibility, not visual size:

- **Atoms** (`app\components\atoms\`): Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, WarnBanner, NavLink, Icons. No business logic, no store reads.
- **Molecules**: ConfirmModal (owns the full confirmation interaction incl. focus management), PanelTable, Pager.
- **Organisms** (`app\components\organisms\`): the shared shell `Layout` (header, drawer nav, notification polling, document.title sync) and its header panels (ProfileMenu, SearchPanel, NotificationsPanel, ChatPanel), plus LeaveRequestForm (+ OptionalHolidayCalendar) because it is reused by two routes.
- **Templates** (`app\components\templates\`): ErrorBoundary (structural client boundary). Route templates are *route-local* and live under each route's `_components\` — they are plain React compositions, not Next layouts; keep Next `layout.tsx` semantics untouched.
- **Pages**: thin `page.tsx` files rendering their `_components\<Name>Template`.

`ConfirmModal` is a molecule because it owns the complete confirmation interaction (dialog semantics, focus trap, Escape/outside dismissal). A generic dialog shell would be an atom if ever introduced.

**Central state lives in `store\AuthContext.tsx`.** On sign-in it resolves the session to the employee profile (`GET /employees/me`), then loads `mine` (`/leave-requests/mine`), `team` (`/leave-requests/team`), `balances` (`/balances/me`) and leave types — all through `services\`, with failed loads toasted via `setToast`. Write helpers `addMine`, `updateMine`, `cancelMine`, `decide`, `decideMany` wrap the leave-request mutations. `AdminContext` (employee roster state) mounts ONLY inside the admin guard hierarchy (`(admin)\layout.tsx`: SigninGuard → Layout → AdminProvider) and unmounts on leaving `/admin/*` — preserve that lifetime.

**Guards** (`app\lib\security\SigninGuard.tsx`): one client guard with `require?: 'manager' | 'admin'`; null while `authReady`, `router.replace('/login')` when signed out, `router.replace('/dashboard')` on the wrong role, and renders the shared `Layout` around children. `(manager)` is a **separate route group from `(employee)`** on purpose: crossing `/leave-requests` must remount the Layout exactly like the pre-migration React Router lifecycle did. `AdminProvider` mounts strictly inside Layout, never globally.

**UI conventions**: markup must keep byte-identical class names (class parity — `.hl-panel-head` survives its misleading name on purpose). Invisible a11y additions (`aria-busy`, `aria-invalid`, `aria-describedby`, `role="status"` toast, dialog semantics) stay. The drawer `NavLink` appends the historical `active` class (the `.nav-item.is-active` CSS rule is a pre-existing dead rule — do not "fix" it). Magic strings come from `constants\index.ts`; dates use `utils\dates.ts` (`todayISO()` local-date, fixes a UTC off-by-one).

## Business rules live in the backend, not the client

FastAPI (`backend\api\app\routes.py`, `security.py`) enforces: JWT session-cookie auth (HS256, `sub`+`exp`, 12 h, no refresh; identical Bearer-header fallback for non-browser clients, disabled via `AUTH_BEARER_FALLBACK` in the compose config; CSRF origin guard on cookie-bearing POST/PUT/PATCH/DELETE), `get_current_user` → `current_employee` → `require_admin` dependency chain, manager-only team listing, `can_decide_for` (admin OR requester's manager) with a self-decision ban, Pending-only edit/cancel, all-or-nothing bulk decisions, overlap exclusion constraint, 3-pick optional-holiday cap under an advisory lock, admin-only `/admin/*` with audited mutations, and proportional annual/contingency/carry-forward policy (`app\leave_policy.py`). Client mirror rules in `app\lib\validation\` are previews only — the server is the source of truth.

Conventions: request numbers `LV-xxxxx`, employee numbers `EM-xxxxx`, plain `'YYYY-MM-DD'` date strings, status/mode/role enums mirrored in `constants\index.ts`.

## Testing

Run from `frontend\`:

- **Unit** (`npm test`): suites under `tests\unit\` (mirroring the pre-refactor grouping; imports follow the new paths). Mocks: `services\apiClient` behind `tests\unit\mocks\apiClient.ts` (never network), navigation behind `tests\unit\router-mocks.ts` (`navMocks` — remember `beforeEach(navMocks.clear())`: module-level spies leak across tests). Type check covers `app services store hooks types utils constants` plus tests via `tsconfig.test.json`.
- **Visual parity**: `tests\e2e\screenshot-visual.mjs` (1440×900 per role, incl. admin) + `compare-visual.mjs`; threshold 0. Investigate differences before re-baselining (18/18 production parity is the standing bar).
- **E2E**: manager `prastina.mary@emids.com`, staff `vikram.deshmukh@emids.com`, admin `admin@emids.com`, password `Portal@2026` (`SEED_PASSWORD` to override) — the FastAPI compose seed. Approvals are irreversible; an approval-cycle spec leaves one Approved `[e2e]` row behind and books future windows avoiding overlaps (API-based cleanup only — never SQL).

## Git conventions

- Origin: `https://github.com/AnuPrasad78/Leave-mangement-model2.git`.
- **Never commit or push without asking the user first** (standing user rule).
- Commit application source, configs and tests (`frontend/app/`, `frontend/services/`, `frontend/store/`, `frontend/hooks/`, `frontend/types/`, `frontend/utils/`, `frontend/constants/`, `frontend/tests/`, `frontend/package.json`, lint/format configs, `backend/`, `.claude/skills/`, CLAUDE.md). Keep `frontend/.env`, `frontend/test-results/`, `frontend/coverage/`, `frontend/.next/`, `frontend/tests/.visual-*/`, `*.tsbuildinfo` out of commits (root `.gitignore` covers `.next/`, `dist/`, `.env`; add `*.tsbuildinfo` at commit time if missing).
