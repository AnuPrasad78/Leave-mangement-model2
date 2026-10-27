---
name: run-dev
description: Start, verify and stop the emids-leave-portal Vite dev server and its FastAPI + Postgres backend (ports, env reload rule, where the app config lives)
---

# Running the leave portal dev server

## Start

The frontend lives at `Leave-managment/emids-leave-portal/frontend` inside this repo; the backend is the FastAPI app in `Leave-managment/emids-leave-portal/backend/api` (compose file: `backend/compose.yaml`). All npm commands run from `frontend/`:

```bash
cd Leave-managment/emids-leave-portal/frontend && npm run dev
```

- Default Vite port is **5173**.
- The desktop preview config (`emids-leave-portal/.claude/launch.json`) runs `npm run dev --prefix frontend -- --port 5174 --strictPort` and previews http://localhost:5174.
- The e2e suite and screenshot tooling (playwright.config.ts / tests/e2e/screenshot-visual.mjs) use **5180**.

## Backend

The backend needs Postgres reachable at `DATABASE_URL` from `backend/api/.env` (gitignored): `DATABASE_URL` pointing at the local Postgres on `127.0.0.1:5432`, `JWT_SECRET`, `CORS_ORIGINS` covering the dev origin in use — including **5174** when previewing — and `DEMO_PASSWORD` for the seeded logins. Start with Docker (`docker compose up --build` from `backend/`) or a local uvicorn run; apply migrations and seed demo data with:

```bash
cd Leave-managment/emids-leave-portal/backend/api
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m app.seed
```

Verify with `curl http://localhost:8000/health/db` → `{"status":"ok","database":"connected"}`.

**Restart the backend whenever `backend/api/.env` changes** (CORS origins, JWT secret) — it reads env at startup only.

## Env config (frontend)

`.env.local` (gitignored, in `frontend/`) holds `VITE_API_BASE_URL` (default `http://localhost:8000`). `.env.example` documents the set.

**Restart the dev server after any `.env.local` change** — Vite only reads env at startup. If routes render blank after a file was deleted/renamed while a server was running, kill the ports first:

```bash
cmd //c "taskkill /pid <PID> /T /F"
```

## Verify

Load `/login` and confirm the sign-in form renders. Signing in with a seeded account should land on `/dashboard`. Console should show only the React Router v7 future-flag warnings (noise is expected) plus a Vite "ready in" line in the server logs.

## Stop

Stop the process that owns the port (`netstat -ano | grep :5173`) rather than leaving orphaned Vite processes behind — a stale process with a stale module graph serves deleted files.
