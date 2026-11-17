# Atomic Design Methodology — emids-leave-portal (Next.js App Router)

## Purpose

Use this file as the operating guide for frontend changes in the migrated and restructured portal (App Router + atomic design, 2026-11).

Goal: make responsibilities explicit, keep reusable components predictable, and make each change small, testable and reversible — without altering user-visible behavior.

## Core rules

1. Preserve existing behavior, markup, class names, accessibility and visual output unless the task explicitly requests a change.
2. No broad structural refactor in one pass.
3. One component boundary per change.
4. Write or update tests before changing production behavior.
5. Keep API access in `services\` (the only fetch seam is `services\apiClient.ts`).
6. Keep business rules in `app\lib\validation\` + `app\lib\utils\` (client mirrors) and in the FastAPI backend (authoritative).
7. Keep feature-specific state in hooks or contexts, never in generic UI atoms.
8. Do not add a component because it might be useful later.
9. Do not rename or move files without recording the behavior contract.
10. Run the relevant tests, `npm run typecheck`, `npm run lint` and `npm run build` after every meaningful change.

## Source layout

```
app/
  layout.tsx  providers.tsx (client: AuthProvider > ErrorBoundary > Toast)  page.tsx (redirect)  not-found.tsx  [...slug]/page.tsx
  (auth)/login/            page.tsx + _components/LoginTemplate.tsx
  (employee)/              layout.tsx (SigninGuard) + dashboard/ apply-leave/ leave-details/ holidays/ separation-request/
                           each: page.tsx + _components/<Name>Template.tsx + route-only components
  (manager)/               layout.tsx (SigninGuard require="manager") + leave-requests/_components/{LeaveRequestsTemplate, LeaveRequestQueue}
  (admin)/                 layout.tsx (SigninGuard require="admin" wrapping Layout > AdminProvider)
                           + admin/{page, employees, leave-policies, audit-logs, reminders} with _components/
  components/              shared atomic design:
    atoms/                 Button, Field, IconButton, Chip, SegmentedControl, PageHead, StatusPill, Toast, Donut, WarnBanner, NavLink, Icons
    molecules/             ConfirmModal, PanelTable, Pager
    organisms/             Layout (shell), ProfileMenu, SearchPanel, NotificationsPanel, ChatPanel, LeaveRequestForm/ (form + OptionalHolidayCalendar — shared by 2 routes)
    templates/             ErrorBoundary
    index.ts               barrel: atoms + molecules
  lib/
    security/SigninGuard.tsx   client guard (require?: 'manager' | 'admin')
    validation/                computeRequest, validateSeparation, proportionalAnnual (client mirrors)
    utils/                     balanceRules, ticker
    assets.ts                  assetSrc(): svg import seam (Vite string vs Turbopack object)
    legacyHolidayData.ts       one-time legacy localStorage import data
services/                     apiClient.ts + one module per API area (fetch seam, { data, error } contracts)
store/                        AuthContext.tsx (global), AdminContext.tsx (admin-routes-only), mappings.ts
hooks/                        useDismiss, useDebouncedValue, usePagedData, useHolidayPicks, usePickedOptionalHolidays
types/  utils/  constants/    models, date/format/role helpers, enums (constants/index.ts)
styles/                       global.css -> layout.css -> login.css -> pages.css (imported in app\layout.tsx, exact order)
app/assets/                   svg logos (import via assetSrc)
tests/                        unit (Vitest, mocked) + e2e (Playwright) + visual baselines
```

No `src\` directory exists. Route-local components MUST live in the route's `_components\`; anything used by two or more routes belongs in `app\components\`.

## Component levels & rules

- **Atoms** — no business logic, no store, no feature imports; props-driven; preserve class names, DOM hierarchy and a11y semantics unless explicitly requested.
- **Molecules** — combine atoms; may own a small interaction (ConfirmModal owns the whole dialog interaction: focus trap, Escape/outside dismissal).
- **Organisms** — complete feature sections; `Layout` owns the shell (header, drawer, 10 s notification polling, document.title sync); `LeaveRequestForm` is form state + validation + submission navigation.
- **Templates** — page-level composition, client-side; route templates live under `_components\`, NOT at `app\components\templates\` (that folder is for cross-route templates like ErrorBoundary).
- **Pages** — thin server `page.tsx` rendering the route template; the client boundary is the template's `'use client'`. Do not put logic directly in `page.tsx`.

## Where things go (reuse decides)

| Component | Location |
|---|---|
| smallest reusable UI | `app\components\atoms\` |
| atoms combined | `app\components\molecules\` |
| large shared UI section | `app\components\organisms\` |
| reusable page composition | `app\components\templates\` |
| used by exactly one route | that route's `_components\` |
| API access | `services\` |
| cross-route state | `store\` |
| hooks | `hooks\` (feature hooks allowed near the route if private) |
| pure domain rules (client mirrors) | `app\lib\validation\` / `app\lib\utils\` |
| enums / magic strings | `constants\index.ts` |

## Client vs Server components

Server Components are the default. Add `'use client'` only where state, effects, browser APIs, event handlers or context exist — in practice every template/organism/atom under the interactive dirs carries it (contexts require it). Never move `services\`/localStorage/`window`-dependent code into Server Components. Nothing reads cookies or middleware — the JWT exists only in the backend-set HttpOnly cookie (`services\apiClient.ts` sends `credentials: 'include'`).

## Module boundaries

- UI components: no service imports, no store imports (organisms receive via props or explicit permission-linked hooks).
- Hooks: coordinate; may call services; never render UI.
- Services: fetch + normalize + map; never import React components.
- Templates/pages: compose organisms; consume `useAuth()` / `useAdmin()`.

## Adding a new route

1. `app\<group>\<route>\page.tsx` — thin wrapper rendering `<XTemplate />`.
2. `_components\<X>Template.tsx` with `'use client'` (or server-only if truly static).
3. Choose the group: `(employee)` (SigninGuard), `(manager)` (SigninGuard require="manager" — separate group so the Layout remount lifecycle is preserved), `(admin)` (SigninGuard require="admin" wrapping AdminProvider), `(auth)` (public).
4. Add nav item to the arrays in `app\components\organisms\Layout.tsx` (NAV / ADMIN_NAV) if it belongs in the drawer.
5. Record expected URL in `tests\unit\app\Redirects.test.tsx` or a route test; run typecheck/lint/build.

## Adding a shared component

Classify by reuse per the table above, place it, export it (via `app\components\index.ts` barrel for atoms/molecules), then run `npm run typecheck && npm test && npm run lint && npm run build`.

## Required testing expectations

- Tests live in `tests\unit\` (Vitest + RTL; `navMocks` for navigation; `mocks\apiClient.ts` for transport) and `tests\e2e\` (Playwright against the compose backend; API-based cleanup; approvals irreversible).
- Do not weaken assertions; visual parity threshold is 0 — investigate diffs, never auto-re-baseline.
- Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run e2e` when UI flows change.

## Protected contracts

Current URLs, `SigninGuard` semantics, `AdminProvider` lifetime inside Layout, `services\` seams, `constants\index.ts` enums, `utils\dates.ts` local-date helpers, the four global CSS files and their import order, and the historical `active` drawer class must never change silently.
