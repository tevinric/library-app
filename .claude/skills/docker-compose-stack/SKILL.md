---
name: docker-compose-stack
description: Use when writing or changing the docker-compose.yml, Dockerfiles, or environment templates for an app in this house style. Covers the three-service layout, healthcheck-gated startup ordering, runtime env vs frontend build args, named volumes and networks, the env_sample/.env/env.sh file strategy, and the rebuild rules that decide whether a change actually reaches production.
---

# Docker Compose stack

Three services — `postgres`, `backend`, `frontend` — in one `docker-compose.yml`
at the repo root, driven by a `.env` beside it.

## The file

```yaml
services:
  postgres:
    image: postgres:16
    container_name: postgres_{app}_app
    environment:
      POSTGRES_DB: ${{APPNAME}_DB_NAME}
      POSTGRES_USER: ${{APPNAME}_DB_USER}
      POSTGRES_PASSWORD: ${{APPNAME}_DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    volumes:
      - {app}_data:/var/lib/postgresql/data
      - ./database/sql_init.sql:/docker-entrypoint-initdb.d/sql_init.sql
      - ./backups:/backups
    ports:
      - "5433:5432"                 # non-default host port avoids clashes
    restart: unless-stopped
    networks: [{app}_network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${{APPNAME}_DB_USER} -d ${{APPNAME}_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: {app}_backend
    ports:
      - "${{APPNAME}_BACKEND_PORT:-5002}:5002"
    environment:                     # RUNTIME — read by os.getenv at request time
      - {APPNAME}_DB_HOST=${{APPNAME}_DB_HOST}
      # ... db vars, ports, secret key, flask env
      - {APPNAME}_AZURE_TENANT_ID=${{APPNAME}_AZURE_TENANT_ID}
      - {APPNAME}_AZURE_CLIENT_ID=${{APPNAME}_AZURE_CLIENT_ID}
      - {APPNAME}_AUTH_DEV_BYPASS=${{APPNAME}_AUTH_DEV_BYPASS:-false}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks: [{app}_network]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:                          # BUILD TIME — baked into the JS bundle
        VITE_{APPNAME}_ENV_TYPE: ${{APPNAME}_FRONTEND_ENV_TYPE:-PROD}
        VITE_{APPNAME}_AZURE_CLIENT_ID: ${{APPNAME}_AZURE_CLIENT_ID}
        VITE_{APPNAME}_AZURE_TENANT_ID: ${{APPNAME}_AZURE_TENANT_ID}
        VITE_{APPNAME}_AZURE_REDIRECT_URI: ${{APPNAME}_AZURE_REDIRECT_URI}
        VITE_{APPNAME}_AZURE_POST_LOGOUT_REDIRECT_URI: ${{APPNAME}_AZURE_POST_LOGOUT_REDIRECT_URI}
    container_name: {app}_frontend
    ports:
      - "${{APPNAME}_FRONTEND_PORT:-3002}:80"
    depends_on: [backend]
    restart: unless-stopped
    networks: [{app}_network]

volumes:
  {app}_data:
    driver: local
    name: {app}_data

networks:
  {app}_network:
    driver: bridge
    name: {app}_network
```

## The distinction that matters most

**`environment:` is runtime. `build.args` is build time.** They are not
interchangeable, and picking the wrong one fails silently:

- The **backend** reads config through `os.getenv` on every request, so runtime
  `environment:` is correct. Change a value, restart the container, done.
- The **frontend** is a static bundle. Vite inlines `VITE_*` values during
  `npm run build`, which happens inside `docker build`. Runtime environment
  reaches nginx, which doesn't care — the values are already compiled into the
  JS. So frontend config **must** go through `build.args`.

A frontend variable placed in `environment:` produces no error and no effect.
This is the most common wasted afternoon with this stack.

## Startup ordering

`depends_on: condition: service_healthy` gates the backend on Postgres
actually accepting connections, not merely on the container existing. Plain
`depends_on: [postgres]` (as used for frontend → backend, where it only
affects ordering) does **not** wait for readiness.

Even with the healthcheck, the backend's `run_migrations()` retries with
backoff — belt and braces, because a healthy Postgres can still refuse a
connection momentarily during startup.

## Data safety

- **Named volume, declared explicitly** with `name:` so it's predictable and
  survives `docker-compose down`.
- **`docker-compose down -v` destroys the database.** Never in a runbook
  without a loud warning; never as a casual "reset".
- `./backups:/backups` is mounted so `pg_dump` inside the container writes to
  the host. See `backup-and-restore`.
- `sql_init.sql` is mounted into `docker-entrypoint-initdb.d`, which Postgres
  runs **only on an empty volume** — schema changes to a live database go
  through `migrations.sql`. See `postgres-schema`.

## Environment file strategy

Three templates, tracked in git with placeholder values; three real files,
gitignored:

| Tracked template | Real file (gitignored) | Read by |
|---|---|---|
| `env_sample` | `.env` | docker-compose, automatically |
| `env_sample.sh` | `env.sh` | `source env.sh` for shell/ops use |
| `frontend/env_sample_frontend` | `frontend/.env` | `npm run dev` only |

- `.env` is the source of truth. It feeds compose, which feeds both backend
  runtime env and frontend build args.
- `env.sh` mirrors it in `export KEY="value"` form. Exported shell variables
  take precedence over `.env` in compose substitution, so
  `source env.sh && docker-compose up --build -d` works as a single step. The
  `export` keywords are load-bearing for scripts that source it plainly.
- `frontend/.env` is **only** for running Vite directly on your machine.
  Docker never reads it — and `frontend/.dockerignore` must exclude it so it
  can't leak into an image.
- **Keep the templates in sync with what compose actually references.** A
  variable compose uses but the template omits resolves to an empty string.
  Where that variable has no `:-default`, the result is a silently broken
  build — an empty redirect URI, an empty client ID. Audit with:
  ```bash
  comm -23 <(grep -oE '[$][{][A-Z_]+' docker-compose.yml | tr -d '${' | sort -u) \
           <(grep -oE '^[A-Z_]+' env_sample | sort -u)
  ```
- Give a `:-default` to anything with a safe default, and make that default the
  **secure** one (`AUTH_DEV_BYPASS:-false`, `FRONTEND_ENV_TYPE:-PROD`).

## Rebuild rules

| Changed | Command |
|---|---|
| Backend Python | `docker-compose up -d --build backend` |
| Frontend source or any `VITE_*` value | `docker-compose up -d --build frontend` |
| `.env` value used at runtime (backend) | `docker-compose up -d` |
| `.env` value used at build time (frontend) | `docker-compose up -d --build frontend` |
| `migrations.sql` | restart backend — it runs on boot |
| `sql_init.sql` only | nothing, on an existing volume — put it in migrations too |

When in doubt on the frontend, `--build`. A plain `up` reusing a stale image
looks exactly like "my change did nothing".

## setup.sh

A first-run bootstrap that fails early with a clear message rather than
half-starting: check `docker` and `docker-compose` exist, create the network
and volume if absent, refuse to continue if `.env` is missing (listing the
required variables), then build and start. End by printing the URLs, the
health endpoint, and the common `docker-compose` commands. It should be safe
to re-run.
