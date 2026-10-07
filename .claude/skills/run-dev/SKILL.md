---
name: run-dev
description: Start, verify and stop the emids-leave-portal Vite dev server (ports, env reload rule, where the app config lives)
---

# Running the leave portal dev server

## Start

The app lives at `Leave-managment/emids-leave-portal` inside this repo. All npm commands run from there:

```bash
cd Leave-managment/emids-leave-portal && npm run dev
```

- Default Vite port is **5173**.
- The desktop preview config (outer session folder `.claude/launch.json`) runs `npm run dev -- --port 5174 --strictPort` and previews http://localhost:5174.
- The e2e suite and screenshot tooling (playwright.config.js / tests/e2e/screenshot-visual.mjs) use **5180**.

## Env config

`.env.local` (gitignored) holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env.example` documents the full set, including the **service-role key which must never carry a `VITE_` prefix** (a `VITE_`-prefixed value is inlined into the client bundle).

**Restart the dev server after any `.env.local` change** — Vite only reads env at startup. If routes render blank after a file was deleted/renamed while a server was running, kill the ports first:

```bash
cmd //c "taskkill /pid <PID> /T /F"
```

## Verify

Load `/login` and confirm the sign-in form renders. Console should show the React Router v7 future-flag warnings only (noise is expected) and a Vite "ready in" line in the server logs.

## Stop

Stop the process that owns the port (`netstat -ano | grep :5173`) rather than leaving orphaned Vite processes behind — a stale process with a stale module graph serves deleted files.
