---
name: portal-conventions
description: How to add or change portal features — page + route patterns (Next.js App Router), where state data and UI live, the reusable ui primitives, a11y rules and the class-parity styling rule
---

# Portal conventions

Target layout (all under `frontend/`):

```
app/                # the Next.js App Router — the only routing layer
  layout.tsx        # root layout; providers.tsx mounts AuthContext
  login/            # Login.tsx (co-located page composition) + page.tsx stub -> makeClientPage(() => import('./Login'))
  (portal)/(manager)/(admin)/   # route groups; each group's layout.tsx is the client-side guard
  api/              # BFF handlers (auth/{login,me,logout}, [...path]) proxying the FastAPI backend
(frontend root — the folders below sit beside app/):
  constants.ts      # backend enum mirrors: STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons
  components/ui/    # atoms/ (Button, Field, PageHead, Chip, SegmentedControl, IconButton, StatusPill,
                    # Toast, Donut, WarnBanner) + molecules/ (PanelTable, ConfirmModal, Pager),
                    # re-exported by the components/ui/index.ts barrel
  components/layout/  # ProfileMenu, ChatPanel, NotificationsPanel, SearchPanel;
                      # components/Layout.tsx owns header + drawer, exports NAV / ADMIN_NAV
  components/feature/ # organisms extracted from pages, props-in (no store reads):
                      # leave-request-form/, leave-request-queue/, leave-request-history/, admin/
  features/         # pure domain rules: leave-requests (computeRequest), balances, holidays
                    # (ticker + useHolidayPicks), separations (validateSeparation), admin
  hooks/            # useDismiss (Escape/outside-mousedown), useDebouncedValue, usePagedData
  lib/session.ts    # server-only JWT session helpers (middleware + BFF route handlers)
  services/         # the ONLY layer reaching the transport — leaveRequests, holidays, balances,
                    # leaveTypes, employees, separations, notifications, admin, legacyMigration,
                    # auth, errors (normalized) — all through apiClient.ts
  store/            # AuthContext.tsx (session/profile/mine/team/balances/toast + mutations),
                    # AdminContext.tsx (admin persona), mappings.ts
  utils/            # dates (fmtDate/dayName/businessDaysBetween/todayISO local), format (fmtDays),
                    # roles (canApprove/isAdmin), balances, ErrorBoundary.tsx
  pages/            # GONE — each route folder owns its page composition instead:
                    # app/<group>/<route>/<Name>.tsx (PageHead + organisms; data via useAuth() only)
```

## Adding a page

1. Create the route folder `app/:portal|manager|admin>/<route>/` — **pick the group by persona**: `(portal)` (any signed-in user), `(manager)` (requires `canApprove(profile)`), `(admin)` (requires `isAdmin(profile)`). The guard lives in the group's `layout.tsx` (redirects: unauthenticated → `/login`, employees of `(manager)`/`(admin)` → `/dashboard`) — pages add no checks of their own.
2. Compose the page co-located in that folder as `<Name>.tsx` using `PageHead` (`<PageHead eyebrow=.. title=.. accent?>` — `accent` reproduces the red eyebrow on separation-style pages); consume `useAuth()` for data, `features/` for rules, `components/feature/` organisms for sections.
3. In the same folder, `page.tsx` is a thin stub: `'use client'` + `makeClientPage(() => import('./<Name>'))` (see `app/clientPage.tsx` — pages render `ssr: false` because session + same-origin fetches only work in the browser).
4. If the nav needs a link, add to `NAV` (or `ADMIN_NAV` for admin-only links) in `components/Layout.tsx` — the filter uses `canApprove`/persona, no per-page checks.

Never import a page from another page or component; never skip `makeClientPage` with a direct render in `page.tsx`.

## Data access

- **Never fetch the backend from a page.** Route it through a `services/*` module (all calls go via `apiClient.ts` → the same-origin `/api` BFF route handlers) returning `{ data, error: normalized }`; the caller decides toast wording via `setToast(error.userMessage, TOAST_KIND.Error)`.
- Toast via `useAuth().setToast` — one global toast (3200 ms); never store timers on function properties.

## UI primitives (write once, reuse)

- `Button {variant: 'primary'|'ghost'|'danger', size?: 'sm', busy, busyLabel, type, ...}` — busy renders the spinner + label and disables; replaces hand-rolled "Submitting…" blocks.
- `Field {label, required, error, as = 'label'|'div', htmlFor}` — wraps any control; when `htmlFor` is provided the control gets `aria-invalid`/`aria-describedby` automatically. Error span class order is `muted mono`.
- `PanelTable {title, count, headExtra, columns[{label, cell, cellClass?, width?, maxWidth?}], rows, rowKey, rowClass?, empty?, emptyBlock?}` — one card/table scaffold for every list; `emptyBlock` replaces the table entirely (leave-history style), `empty` renders the `.table__empty` row. `Pager` pairs with it for the paged lists (`usePagedData`).
- `Chip {isOn, className = 'chip'}` + `SegmentedControl {value, options, onChange, ariaLabel}` for toggles; give single controls `id`s and pass `htmlFor` to Field.
- `ConfirmModal {title, text, confirmLabel, danger, onConfirm, onClose}` — Escape/aria/focus-trap are built in; `useDismiss(ref, {onClose, enabled, escape?, outside?})` for drawer/popover behaviour (options preserve each consumer's semantics — don't silently unify).

## Styling

- Global CSS files in `styles/` keep the token system from `global.css` (`--teal` ramp, `--ink*`, hairlines, mono label voice). Markup from ui primitives must stay **byte-identical to the rendered app** (class parity, e.g. `hl-panel-head` deliberately survives its misleading name) — visual regressions are caught by `tests/e2e/screenshot-visual.mjs` + `compare-visual.mjs`.
- No inline styles for repeated patterns; use a class (`.table-scroll` replaced the per-table `overflowX` wrappers).

## TDD flow

Every behavior change starts as a failing test next to its area (`tests/unit/...` mirrors `...` and `app/...`); e2e specs in `tests/e2e/*.spec.ts` cover the visible user flows against the real FastAPI backend. See the run-tests skill for commands and DB etiquette.
