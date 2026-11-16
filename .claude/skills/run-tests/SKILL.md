---
name: run-tests
description: Run the portal's unit (Vitest, fully mocked) and e2e (Playwright against the real FastAPI backend) suites, filter specs, and understand the mutation/cleanup etiquette
---

# Testing the leave portal

Run from `Leave-managment/emids-leave-portal/frontend`.

## Unit tests (Vitest, jsdom, fully mocked — no network)

```bash
cd Leave-managment/emids-leave-portal/frontend && npm test        # single run
cd Leave-managment/emids-leave-portal/frontend && npm run test:watch
```

- All backend I/O is behind `services/*`, so unit tests mock `services/apiClient` via `vi.mock` with the spy in `tests/unit/mocks/apiClient.ts` (`apiRequest = vi.fn()` + `resetApiClientMock()`). Route handlers, middleware and `lib/session` have their own node-env suites under `tests/unit/{lib,middleware,app}` (`@vitest-environment node` docblock).
- Tests are TDD-first: change behavior by writing/updating the failing test before the implementation.
- Suites mirror `app/` and the root folders: `tests/unit/{lib,middleware,app,utils,store,services,features,components/{ui,feature,layout},hooks,pages}`.

## E2E tests (Playwright against the REAL FastAPI backend)

```bash
cd Leave-managment/emids-leave-portal/frontend && npm run e2e            # needs seeded users
cd Leave-managment/emids-leave-portal/frontend && npx playwright test tests/e2e/apply-leave.spec.ts   # one spec
```

- The config boots its own Next.js dev server on **5180** (`reuseExistingServer: true`), `workers: 1` so mutating specs never race. Needs the FastAPI backend running (compose) and the frontend's server-only env (`API_INTERNAL_URL` + paired `JWT_SECRET`).
- Logins: `tests/e2e/fixtures.ts` — manager `sai.nithinreddy@emids.com`, staff `vikram.deshmukh@emids.com`, password `Portal@2026` (override with `SEED_PASSWORD`); both must exist in the backend's seeded user table.
- Windows one-time setup: `npx playwright install chromium` (~150 MB).

## Mutation etiquette

The seeded demo database is shared between runs. Etiquette encoded in the specs:

- **apply-leave** — creates a marked `[e2e]` request ~60 days out (the backend rejects overlapping active date ranges), then cancels it in-test. The Cancelled row remains in history; a full reset is `docker compose -f backend/compose.yaml down -v` then `up -d db api` (the api entrypoint re-seeds when the DB is empty).
- **holidays** — picks one optional holiday and unpicks it (fully reversible).
- **leave-requests / staff redirect** — skipped automatically when the staff account isn't provisioned. Approve decisions are irreversible, so the spec only decides requests created inside the test.
- **separation** — stops at the confirm modal (a submitted separation is HR-visible with no UI undo).
- After debugging manually, check `optional_holiday_picks` and `leave_requests` for stray `[e2e]` rows. Demo logins are provisioned by the backend seed (`app/bootstrap.py` / `app/seed.py`, `DEMO_PASSWORD`); if a login is missing, re-seed the backend rather than hand-creating users.

## Visual parity

`tests/e2e/screenshot-visual.mjs` captures every route per role at 1440×900 into `tests/.visual-baseline` (`--out tests/.visual-after` for the after-set, `--roles manager,staff`). `tests/e2e/compare-visual.mjs` pixel-diffs the sets (threshold 0 by default). Goal: `npm run build` + 3 identical routes, ≤ a few sub-glyph AA pixels elsewhere.
