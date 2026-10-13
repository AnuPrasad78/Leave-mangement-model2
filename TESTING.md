# Testing Guide — emids-leave-portal

Three independent runners, one per layer of the stack. Nothing here ever touches the
development `leave_portal` database holding real employee data.

| Layer | Runner | Location | Talks to |
|---|---|---|---|
| Frontend unit/component | Vitest + Testing Library (`npm test`) | `Leave-managment/emids-leave-portal/frontend` | fully mocked transport (no network) |
| Frontend E2E | Playwright (`npm run e2e`) | same | real dev server on :5180 + real FastAPI backend + real Postgres |
| Backend API | pytest (`python -m pytest`) | `Leave-managment/emids-leave-portal/backend/api` | **real Postgres** — dedicated test database only |

## Golden rule

> Backend integration tests must never run against the development `leave_portal`
> database. The harness enforces this: without `TEST_DATABASE_URL` it spins up its own
> ephemeral `postgres:16` container; with `TEST_DATABASE_URL` it **refuses to run** unless
> the database *name* contains "test" (a live guard against pointing CI at the dev DB).

## Frontend — unit & coverage

```bash
cd Leave-managment/emids-leave-portal/frontend
npm ci                 # first time
npm test               # vitest run — all TS suites, fully mocked
npm run test:coverage  # thresholds enforced (lines 70 / branches 60 / functions 65 / statements 70)
npx vitest run tests/unit/pages/Login.test.tsx          # one file
npx vitest run -t "clears the toast"                    # one test by name
typecheck: npm run typecheck   # two projects: strict src + tsconfig.test.json
```

Coverage artifacts land in `frontend/coverage/` (text + HTML + lcov).

## Frontend — E2E (manual/local by design)

Requires the real backend reachable (Docker compose up: see "Docker layout" below),
then:

```bash
npm run e2e            # boots its own Vite dev server on :5180 (strict port)
npx playwright test tests/e2e/apply-leave.spec.ts       # one spec
npx playwright test -g "manager sign-in"                # one test by name
```

Mutating specs create their own rows and clean up after themselves; logins come from
`tests/e2e/fixtures.ts` (see `SEED_PASSWORD`). Requires the seeded auth users created by
the Supabase setup skill (`supabase-setup`).

## Backend — pytest

```bash
cd Leave-managment/emids-leave-portal/backend
python -m venv .venv && .venv/Scripts/python -m pip install -r api/requirements.txt -r api/requirements-dev.txt   # Windows Git Bash
source .venv/bin/activate && pip install -r api/requirements.txt -r api/requirements-dev.txt                       # POSIX
```

(The canonical local venv is `backend/.venv`; run everything, including uvicorn, from it.)

### Mode 1 (default) — ephemeral Docker

Needs a running Docker daemon. conftest starts an auto-removed `postgres:16` container
(random host port), runs Alembic migrations, and truncates every table around each test.

```bash
python -m pytest                                              # everything
python -m pytest -m unit                                      # fast tests only (no DB)
python -m pytest -m integration                               # API + real Postgres
python -m pytest tests/test_decisions.py::test_bulk_with_one_unknown_request_rolls_back_everything
```

### Mode 2 — pinned external Postgres (`TEST_DATABASE_URL`)

Used by CI (GitHub Actions service) and by runner scripts on machines without Docker:

```bash
# GitHub Actions service container:
TEST_DATABASE_URL=postgresql+psycopg://leave_test:leave_test@127.0.0.1:5432/leave_test python -m pytest

# A db started from `docker compose up -d db` — create a dedicated test db first:
docker exec -it <pg-container> createdb -U leave_app leave_portal_test
TEST_DATABASE_URL="postgresql+psycopg://leave_app:<admin-password>@127.0.0.1:5432/leave_portal_test" \
  python -m pytest
```

The URL must contain a database name with "test" in it. Against any other name the suite
exits immediately with:

```
Refusing to run tests against database 'leave_portal'. TEST_DATABASE_URL must point at a dedicated test database ...
```

That error is a **safety feature** — it means you aimed the suite at a real database.

### Coverage

```bash
python -m pytest --cov=app --cov-report=xml --cov-fail-under=75
```

## Isolation model (why it is safe)

* Backend conftest truncates **all** tables (`RESTART IDENTITY CASCADE`) before *and*
  after every test — no test depends on order or leftover rows.
* Tests create their own users/employees/requests via factory fixtures; anything a spec
  built, it tore down.
* E2E specs only mutate rows they created (search `[e2e]` markers); visual baselines live
  under `frontend/tests/.visual-*/` (gitignored).

## Docker layout (verified)

`backend/compose.yaml`

* `db` — `postgres:16`, named volume `postgres_data`, database **`leave_portal`**
  (this is the shared development database — keep it out of tests).
* `api` — FastAPI image (`backend/api/Dockerfile`): `alembic upgrade head && uvicorn` on :8000.
* `frontend` — built with `VITE_API_BASE_URL=http://localhost:8000`, served via nginx on :80.

Local backend tests use **neither** of those resources — see the golden rule above.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No way to obtain a test Postgres` | Docker daemon down, and no `TEST_DATABASE_URL` set. Start Docker or export a `TEST_DATABASE_URL` pointing at a *test-named* db. |
| Orphaned ephemeral container from a crashed run | conftest reuses it automatically; remove it with: `docker ps --filter label=emids-leave-portal-tests` then `docker rm -f <id>`. |
| `port already allocated 5432` | the compose `db` is bound to host 5432 — the ephemeral container uses a random port; a `TEST_DATABASE_URL` copy must use its own db *name* (`leave_test`), collisions otherwise. |
| `REFUSING to run against non-test database` | you aimed `TEST_DATABASE_URL` at the dev `leave_portal` db — create/point at a test-named db instead. |
| Playwright: `Port 5180 is already in use` | an old dev server is holding the strict port; `reuseExistingServer` will reuse a healthy one, otherwise kill it. |
| Vitest exits 1 on macOS/Linux CI after env change | `VITE_API_BASE_URL` is resolved at build time; unit tests don't read it (transport is mocked). |
