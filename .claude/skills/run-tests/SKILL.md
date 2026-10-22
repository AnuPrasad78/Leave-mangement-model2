---
name: run-tests
description: Run the portal's unit (Vitest, fully mocked) and e2e (Playwright, real running backend) suites, filter specs, and understand the mutation/cleanup etiquette
---

# Testing the leave portal

Run from `Leave-managment/emids-leave-portal/frontend`.

## Unit tests (Vitest, jsdom, fully mocked — no network)

```bash
cd Leave-managment/emids-leave-portal/frontend && npm test        # single run
cd Leave-managment/emids-leave-portal/frontend && npm run test:watch
```

- All backend I/O is behind `src/services/*`, and the suites mock the transport so no test touches the network (e.g. `tests/unit/mocks/apiClient.ts` for the API-client seam, plus per-suite service fakes for the store/pages).
- Tests are TDD-first: change behavior by writing/updating the failing test before the implementation.
- Suites mirror `src/`: `tests/unit/{utils,features,store,services,components/{ui,feature,layout},hooks,pages}`.

## E2E tests (Playwright against the real running backend)

```bash
cd Leave-managment/emids-leave-portal/frontend && npm run e2e            # needs seeded users
cd Leave-managment/emids-leave-portal/frontend && npx playwright test tests/e2e/apply-leave.spec.ts   # one spec
```

- The config boots its own Vite dev server on **5180** (`reuseExistingServer: true`), `workers: 1` so mutating specs never race.
- The backend must be running (`docker compose up` or a local uvicorn) with migrations applied and `python -m app.seed` seeded: `backend/api/.env` sets `DEMO_PASSWORD`.
- Logins from `tests/e2e/fixtures.ts`: manager `sai.nithinreddy@emids.com`, staff `vikram.deshmukh@emids.com`, password `Portal@2026` (override with `SEED_PASSWORD`). The fully seeded demo set (11 profiles) also includes `prastina.mary@emids.com` (manager).
- Windows one-time setup: `npx playwright install chromium` (~150 MB).

## Mutation etiquette

The DB is shared. Etiquette encoded in the specs:

- **apply-leave** — creates a marked `[e2e]` request ~60 days out (the DB rejects overlapping Pending/Approved date ranges), then cancels it in-test. The Cancelled row remains in history; reseed with `python -m app.seed` (idempotent) if you want the demo rows refreshed.
- **holidays** — picks one optional holiday and unpicks it (fully reversible).
- **leave-requests / staff redirect** — skipped automatically when the staff account isn't provisioned. Approve decisions are irreversible, so the spec only decides requests created inside the test.
- **separation** — stops at the confirm modal (a submitted separation is HR-visible with no UI undo).
- After debugging manually, check `optional_holiday_picks` and `leave_requests` for stray `[e2e]` rows.

## Visual parity

`tests/e2e/screenshot-visual.mjs` captures every route per role at 1440×900 into `tests/.visual-baseline` (`--out tests/.visual-after` for the after-set, `--roles manager,staff`). `tests/e2e/compare-visual.mjs` pixel-diffs the sets (threshold 0 by default). Goal: `npm run build` + 3 identical routes, ≤ a few sub-glyph AA pixels elsewhere.
