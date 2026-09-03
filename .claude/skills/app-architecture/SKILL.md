---
name: app-architecture
description: Start here when building a new app from scratch in this house style, or when adding a major piece to an existing one. Defines the stack (Postgres + Flask + React/Vite + Docker Compose + Entra ID), the project layout, the {APPNAME} naming convention, and the build order. Points at the specific skills for database, backend, frontend, compose, security, and backups.
---

# App architecture — house style

The reference implementation is `library-app`. Every skill in this folder was
extracted from it. When something here is ambiguous, read the equivalent file
in that repo rather than inventing a variant.

## The stack

| Layer | Choice | Non-negotiable because |
|---|---|---|
| Database | PostgreSQL 16, in Docker, named volume | Data outlives containers |
| Backend | Flask + psycopg2 (`RealDictCursor`), Gunicorn | Rows arrive as dicts, JSON-ready |
| Frontend | React 18 + Vite 5 + Tailwind, served by nginx | Static bundle, no Node in production |
| Auth | Microsoft Entra ID, SPA public client, server-verified tokens | See `secure-entra-app-auth` |
| Orchestration | Docker Compose, one file at repo root | One command to stand the whole thing up |
| Ingress | nginx in the frontend container proxies `/api` to the backend | Frontend and API are same-origin in production |

Deviating from any row is a decision worth stating out loud, not a default.

## Project layout

```
{app}/
├── docker-compose.yml          # the whole stack
├── env_sample                  # template -> .env (compose reads it)
├── env_sample.sh               # template -> env.sh (shell exports)
├── setup.sh                    # first-run bootstrap
├── .gitignore                  # .env, env.sh, dist/, __pycache__, backups/*.sql*
├── database/
│   └── sql_init.sql            # fresh-volume schema only
├── backend/
│   ├── app.py                  # the entire API (single file, sectioned)
│   ├── migrations.sql          # idempotent, runs every boot
│   ├── gunicorn_config.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api.js              # every endpoint, one place
│   │   ├── authConfig.js       # MSAL config
│   │   ├── main.jsx            # MSAL bootstrap
│   │   ├── App.jsx             # auth gate + shell + routes
│   │   ├── App.css             # component classes
│   │   ├── components/Icons.jsx
│   │   └── pages/              # one file per route
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .dockerignore           # must exclude .env
├── scripts/                    # backup, ops
└── guides/                     # deployment/runbook docs
```

The backend being a single `app.py` is deliberate at this scale — sectioned
with banner comments (`# ===== ENTITY ENDPOINTS =====`), not split into
packages. Split it only when a second developer is working in it daily.

## Naming — the {APPNAME} convention

Pick one uppercase prefix per app and use it everywhere. In `library-app` it's
`ZOELIBRARYAPP`. This makes every variable greppable and prevents collisions
when several of these apps run on one host.

```
{APPNAME}_DB_HOST / _DB_PORT / _DB_NAME / _DB_USER / _DB_PASSWORD
{APPNAME}_FRONTEND_PORT / _BACKEND_PORT
{APPNAME}_SECRET_KEY / _FLASK_ENV
{APPNAME}_AZURE_TENANT_ID / _AZURE_CLIENT_ID
{APPNAME}_AZURE_REDIRECT_URI / _AZURE_POST_LOGOUT_REDIRECT_URI
{APPNAME}_AUTH_DEV_BYPASS
```

Frontend variables are the same names with a `VITE_` prefix, because Vite only
exposes variables it can see: `VITE_{APPNAME}_AZURE_CLIENT_ID`.

Docker identifiers follow the app, not the prefix:

```
container: postgres_{app}_app, {app}_backend, {app}_frontend
network:   {app}_network        volume: {app}_data
```

Ports: pick a unique pair per app on the host (library-app uses 3002/5002) so
several apps coexist. Postgres is published on a non-default host port
(library-app uses 5433) to avoid clashing with a local Postgres.

## Build order

Follow this sequence — each step is testable before the next one exists.

1. **Decide the domain model and the app prefix.** Everything downstream keys
   off both.
2. **`database/sql_init.sql`** — schema for a fresh volume. See `postgres-schema`.
3. **`docker-compose.yml` + `env_sample`** — stand up Postgres alone, confirm
   it's healthy. See `docker-compose-stack`.
4. **`backend/`** — health check first, then one entity end-to-end (list,
   get, create, update, delete), then the rest. See `flask-backend-api`.
5. **Auth** — wire Entra before building more than one entity, so every route
   you add afterwards is protected by default. See `secure-entra-app-auth`.
6. **`frontend/`** — `api.js`, then the auth gate, then pages. See `react-frontend`.
7. **Ingress** — the app's own `frontend/nginx.conf` (SPA routing plus the
   `/api` proxy to the backend). Everything beyond the container — public
   hostname, TLS, tunnel — is configured on the VPS itself, outside this repo.
   The one thing that reaches back into the app: the public origin must match
   the Entra redirect URI, which is baked into the frontend at build time.
8. **Backups, before real data exists.** See `backup-and-restore`.
9. **Security pass.** See `security-baseline`.

Auth at step 5 rather than last is the important ordering choice: retrofitting
authentication onto a finished API is how the header-trust vulnerability in
`library-app`'s history happened.

## Cross-cutting rules

- **Every domain table carries `user_id`** referencing the acting user, so
  every row records who created it. Provenance is schema-level, not optional.
- **Every authenticated request is logged** to an `activity_log` table via
  `@app.after_request`. Failed auth and public endpoints are deliberately not
  logged.
- **Collect the minimum personal data the feature actually needs**, and prefer
  a generated opaque identifier to a name. `library-app` identifies borrowers
  by a random 8-character `borrower_id` and stores no name at all.
- **Secrets never reach the frontend.** Anything `VITE_`-prefixed is public.
- **Config is environment variables, read once at startup**, never hardcoded
  and never read from a file the client can influence.

## The related skills

- `postgres-schema` — tables, migrations, the two-file model
- `flask-backend-api` — app.py structure, route pattern, gunicorn
- `react-frontend` — pages, api.js, the design system
- `docker-compose-stack` — service wiring, healthchecks, build args
- `secure-entra-app-auth` — Entra registration and token verification
- `security-baseline` — the cross-cutting security posture
- `backup-and-restore` — pg_dump, offsite, retention, restore drills
