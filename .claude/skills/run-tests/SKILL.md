---
name: run-tests
description: Run the portal's unit (Vitest, fully mocked) and e2e (Playwright, real Supabase) suites, filter specs, and understand the mutation/cleanup etiquette
---

# Testing the leave portal

Run from `Leave-managment/emids-leave-portal`.

## Unit tests (Vitest, jsdom, fully mocked — no network)

```bash
cd Leave-managment/emids-leave-portal && npm test        # single run
cd Leave-managment/emids-leave-portal && npm run test:watch
```

- All Supabase I/O is behind `src/services/*`, so unit tests mock `src/lib/supabase` via `vi.mock` with the chainable fake in `tests/unit/mocks/supabase.js`. Queue responses with `mockDb.expectSelect/expectInsert/expectUpdate/expectDelete` (matched by table + operation + optional eq column).
- Tests are TDD-first: change behavior by writing/updating the failing test before the implementation.
- Suits mirror `src/`: `tests/unit/{utils,store,services,components/{ui,layout},hooks}`.

## E2E tests (Playwright against the REAL hosted Supabase)

```bash
cd Leave-managment/emids-leave-portal && npm run e2e            # needs seeded users
cd Leave-managment/emids-leave-portal && npx playwright test tests/e2e/apply-leave.spec.js   # one spec
```

- The config boots its own Vite dev server on **5180** (`reuseExistingServer: true`), `workers: 1` so mutating specs never race.
- Logins: `tests/e2e/fixtures.js` — manager `sai.nithinreddy@emids.com`, staff `vikram.deshmukh@emids.com`, password `Portal@2026` (override with `SEED_PASSWORD`).
- Windows one-time setup: `npx playwright install chromium` (~150 MB).

## Mutation etiquette

The hosted DB is shared. Etiquette encoded in the specs:

- **apply-leave** — creates a marked `[e2e]` request ~60 days out (the DB rejects overlapping Pending/Approved date ranges), then cancels it in-test. The Cancelled row remains in history; reseed with `supabase/schema.sql` + `seed.sql` to wipe.
- **holidays** — picks one optional holiday and unpicks it (fully reversible).
- **leave-requests / staff redirect** — skipped automatically when the staff account isn't provisioned. Approve decisions are irreversible, so the spec only decides requests created inside the test.
- **separation** — stops at the confirm modal (a submitted separation is HR-visible with no UI undo).
- After debugging manually, check `optional_holiday_picks` and `leave_requests` for stray `[e2e]` rows; `scripts/seed-users.mjs` recreates auth users idempotently.

## Visual parity

`tests/e2e/screenshot-visual.mjs` captures every route per role at 1440×900 into `tests/.visual-baseline` (`--out tests/.visual-after` for the after-set, `--roles manager,staff`). `tests/e2e/compare-visual.mjs` pixel-diffs the sets (threshold 0 by default). Goal: `npm run build` + 3 identical routes, ≤ a few sub-glyph AA pixels elsewhere.
