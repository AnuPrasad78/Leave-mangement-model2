---
name: portal-conventions
description: How to add or change portal features — page + route patterns, where state data and UI live, the reusable ui primitives, a11y rules and the class-parity styling rule
---

# Portal conventions

Target layout (all under `src/` unless noted):

```
constants.js        # DB enum mirrors: STATUSES, MODES, ROLES, TOAST_KIND, MAX_PICKS, separationReasons
components/ui/      # reusable primitives: Button, Field, PageHead, PanelTable, Chip, SegmentedControl,
                    # IconButton, StatusPill, Toast, Donut, WarnBanner, ConfirmModal (index.jsx barrel)
components/layout/  # ProfileMenu, ChatPanel (split out of Layout.jsx)
hooks/useDismiss.js # Escape/outside-mousedown dismissal for popovers, drawers, dialogs
services/           # the ONLY layer importing lib/supabase — leaveRequests, holidays, balances,
                    # leaveTypes, employees, separations, legacyMigration, errors (normalizeSupabaseError)
store/              # AuthContext.jsx (session/profile/mine/team/balances/toast + mutations), mappings.js
utils/              # dates (fmtDate/dayName/businessDaysBetween/todayISO local), format (fmtDays),
                    # roles (canApprove), balances (balanceRow/balanceValue), ErrorBoundary
pages/              # 7 routing targets, consume ui + services only
```

## Adding a page

1. Create `pages/<Name>.jsx` using `PageHead` (`<PageHead eyebrow=.. title=.. accent?>` — `accent` reproduces the red eyebrow on separation-style pages).
2. Register the route in `src/App.jsx` — wrap in `<Guard>` for sign-in; `<ManagerOnly>` additionally requires `canApprove(profile)`.
3. If the layout nav needs a link, add to `NAV` in `components/Layout.jsx` — the filter uses `canApprove`, no per-page checks.

## Data access

- **Never query Supabase from a page.** Route it through a `services/*` module returning `{ data, error: normalized }`; the caller decides toast wording via `setToast(error.userMessage, TOAST_KIND.Error)`.
- Toast via `useAuth().setToast` — one global toast (3200 ms); never store timers on function properties.

## UI primitives (write once, reuse)

- `Button {variant: 'primary'|'ghost'|'danger', size?: 'sm', busy, busyLabel, type, ...}` — busy renders the spinner + label and disables; replaces hand-rolled "Submitting…" blocks.
- `Field {label, required, error, as = 'label'|'div', htmlFor}` — wraps any control; when `htmlFor` is provided the control gets `aria-invalid`/`aria-describedby` automatically. Error span class order is `muted mono`.
- `PanelTable {title, count, headExtra, columns[{label, cell, cellClass?, width?, maxWidth?}], rows, rowKey, rowClass?, empty?, emptyBlock?}` — one card/table scaffold for every list; `emptyBlock` replaces the table entirely (leave-history style), `empty` renders the `.table__empty` row.
- `Chip {isOn, className = 'chip'}` + `SegmentedControl {value, options, onChange, ariaLabel}` for toggles; give single controls `id`s and pass `htmlFor` to Field.
- `ConfirmModal {title, text, confirmLabel, danger, onConfirm, onClose}` — Escape/aria/focus-trap are built in; `useDismiss(ref, {onClose, enabled, escape?, outside?})` for drawer/popover behaviour (options preserve each consumer's semantics — don't silently unify).

## Styling

- Global CSS files in `src/styles/` keep the token system from `global.css` (`--teal` ramp, `--ink*`, hairlines, mono label voice). Markup from ui primitives must stay **byte-identical to the rendered app** (class parity, e.g. `hl-panel-head` deliberately survives its misleading name) — visual regressions are caught by `tests/e2e/screenshot-visual.mjs` + `compare-visual.mjs`.
- No inline styles for repeated patterns; use a class (`.table-scroll` replaced the per-table `overflowX` wrappers).

## TDD flow

Every behavior change starts as a failing test next to its area (`tests/unit/...` mirrors `src/...`); e2e specs in `tests/e2e/*.spec.js` cover the visible user flows against the real backend. See the run-tests skill for commands and DB etiquette.
