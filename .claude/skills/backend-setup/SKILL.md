---
name: backend-setup
description: Bootstrap or verify the FastAPI backend behind the portal — docker compose stack, Alembic migrations, demo seeding, the env-var contract, and how the frontend pairs with it
---

# Backend setup for the leave portal

The backend is a FastAPI app under `backend/api/` (`app/` package, Alembic migrations in
`backend/api/migrations/versions/`, pytest suite in `backend/api/tests/`) on a containerized
Postgres 16. There is no hosted Supabase in the runtime path — the legacy SQL project was
removed from the repo; only data migration from it would ever need those scripts.

## The compose stack

From the repo root (`Leave-managment/emids-leave-portal`):

```bash
docker compose -f backend/compose.yaml up -d db api     # Postgres 16 :5432 + FastAPI :8000
docker compose -f backend/compose.yaml up -d frontend   # optional: full-stack frontend :3000
```

- The `api` container's entrypoint (`backend/api/Dockerfile` CMD) runs `alembic upgrade head`
  then `uvicorn app.main:app` on :8000 (`127.0.0.1:8000` from the host).
- On startup the entrypoint seeds demo data **exactly once** (`app/bootstrap.py`): if the
  users table is empty and `DEMO_PASSWORD` is set, it runs `seed.seed_demo_data()` from
  `app/seed_data.py` (idempotent upserts). Restarts never touch existing data; a `down -v`
  wipes the `postgres_data` volume and the next `up` re-seeds from scratch.
- `postgress` data lives in the named `postgres_data` volume.

## Env-var contract

`backend/api/.env` (gitignored; `backend/api/.env.example` documents the set) — used when the
API runs locally; under compose these arrive through `compose.yaml` environment instead:

- `DATABASE_URL` — `postgresql+psycopg://leave_app:<password>@localhost:5432/leave_portal`
- `JWT_SECRET` — signs the session JWT the BFF forwards as a Bearer token
- `ACCESS_TOKEN_MINUTES` (default 720)
- `DEMO_PASSWORD` — needed for the demo seed (`Portal@2026` default under compose); without it
  the seed is a no-op and the API starts on an empty database
- `CORS_ORIGINS` — the allowed Next.js origins

**Frontend pairing** — `frontend/.env.local` must set `API_INTERNAL_URL` (`http://api:8000`
under compose's frontend service, `http://localhost:8000` for a local Next dev server) and a
`JWT_SECRET` **identical to the backend's**, or cookie verification fails on every request.

## Demo logins (after seeding)

All log in with the `DEMO_PASSWORD` (`Portal@2026`) — defined in `app/seed_data.py`:

- `admin@emids.com` — admin persona
- `prastina.mary@emids.com`, `sandeep.venkateshkamath@emids.com` — managers
- `vikram.deshmukh@emids.com` (EM-20810) plus eight more staff employees

Caveat: the e2e fixtures pin manager `sai.nithinreddy@emids.com`, which the backend seed does
**not** include — if a manager-role e2e spec can't log in, provision that user manually or
point the fixtures at a seeded manager.

## Local dev without Docker

Keep the `db` service up and run the API on the host with the `.env` above:

```bash
docker compose -f backend/compose.yaml up -d db
cd backend/api && alembic upgrade head && python -m uvicorn app.main:app --reload --port 8000
```

Backend tests don't need Docker at all: `backend/api/scripts/run-backend-tests.ps1` runs pytest
against a throwaway PostgreSQL 16 built from portable Windows binaries (port 55432 by default;
it cleans up unless `-KeepRunning`).

## Verify

- `GET http://localhost:8000/docs` renders the OpenAPI UI.
- Sign in through the portal (`/login`) with a demo login — success means the BFF → API JWT pair
  (matching `JWT_SECRET`) works end to end.
- `alembic upgrade head` logs "Context impl Migrations already at head" on a seeded DB.
