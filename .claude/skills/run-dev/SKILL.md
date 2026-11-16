---
name: run-dev
description: Start, verify and stop the emids-leave-portal Next.js dev server (ports, env reload rule, where the app config lives)
---

# Running the leave portal dev server

## Start

The app lives at `Leave-managment/emids-leave-portal/frontend` inside this repo (Next.js App Router). All npm commands run from there:

```bash
cd Leave-managment/emids-leave-portal/frontend && npm run dev
```

- Default Next port is **3000**; the desktop preview config (`emids-leave-portal/.claude/launch.json`) runs `npm run dev --prefix frontend -- -p 5174` and previews http://localhost:5174.
- The e2e suite and screenshot tooling (playwright.config.ts / tests/e2e/screenshot-visual.mjs) use **5180**.

## Env config

`.env.local` (gitignored, in `frontend/`) holds the server-only env: `API_INTERNAL_URL` (FastAPI backend) and `JWT_SECRET` (must match the backend's value; it signs the `lp_session` cookie and is read by the route handlers + middleware). `.env.example` documents the full set. This is server-only config — nothing here is `NEXT_PUBLIC_`-prefixed, and the secret must never be made public.

**Restart the dev server after any `.env.local` change** — Next only reads env at startup. Never run `npm run build` while a dev server is up: both write `.next/` and corrupt each other's module graph (symptom: `Cannot find module './xxx.js'` / version-mismatch RSC errors). Kill the ports first:

```bash
cmd //c "taskkill /pid <PID> /T /F"
```

## Verify

Load `/login` and confirm the sign-in form renders. Console should be error-free; the server logs show a Next "Ready in" line. Routes are client-rendered (`dynamic(..., { ssr: false })` wrappers in `app/**/page.tsx`), so an initial blank flash before hydration is expected, matching the old SPA.

## Stop

Stop the process that owns the port (`netstat -ano | grep :5173`) rather than leaving orphaned Next processes behind — a stale process with a stale module graph serves deleted files.
