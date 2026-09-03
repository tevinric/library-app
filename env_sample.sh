#!/bin/bash
# =============================================================================
# Copy to `env.sh` (gitignored) and fill in, then `source env.sh` before
# deploying. Shell-export mirror of `env_sample` — same variable names, same
# set of variables, shell syntax.
#
# Exported shell variables take precedence over the `.env` file when
# docker-compose does ${VAR} substitution, so sourcing this covers both the
# backend's runtime environment and the frontend's build args in one step:
#
#   source env.sh && docker-compose up --build -d
#
# scripts/postgresql_backup.sh also reads these — it prefers .env and falls
# back to env.sh, sourcing this file plainly, so the `export` keywords matter.
# =============================================================================

# Optional. The backup script auto-detects the repo root when this is unset.
# export PROJECT_ROOT="/path/to/library-app"

# --- Database (postgres container + backend runtime) -------------------------
export ZOELIBRARYAPP_DB_HOST="postgres_library_app"
export ZOELIBRARYAPP_DB_PORT="5432"
export ZOELIBRARYAPP_DB_NAME="library_app_db"
export ZOELIBRARYAPP_DB_USER="libraryuser"
export ZOELIBRARYAPP_DB_PASSWORD=""

# --- Ports -------------------------------------------------------------------
# FRONTEND_PORT is also read by the backend to build its CORS allow-list.
export ZOELIBRARYAPP_FRONTEND_PORT="3002"
export ZOELIBRARYAPP_BACKEND_PORT="5002"

# --- Flask -------------------------------------------------------------------
export ZOELIBRARYAPP_SECRET_KEY=""
export ZOELIBRARYAPP_FLASK_ENV="production"

# --- Entra ID ----------------------------------------------------------------
# One app registration serves both sides: the backend validates that access
# tokens were issued by this tenant for this client ID, and the frontend signs
# in against the same pair. Who is allowed in is controlled in Entra itself
# (Enterprise Applications -> this app -> Properties -> "Assignment required?
# = Yes", then Users and groups -> assign the people you want to allow).
export ZOELIBRARYAPP_AZURE_TENANT_ID=""
export ZOELIBRARYAPP_AZURE_CLIENT_ID=""

# Frontend build args only. Must exactly match a redirect URI registered with
# platform type SPA on the app registration (App registrations -> Authentication).
export ZOELIBRARYAPP_AZURE_REDIRECT_URI=""
export ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI=""

# --- Local dev escape hatches (leave as-is for any real deployment) ----------
# Skips Entra token verification and trusts an X-User-Email header instead.
# NEVER true anywhere other people or the internet can reach the backend —
# it lets any caller impersonate any user.
export ZOELIBRARYAPP_AUTH_DEV_BYPASS="false"

# Builds the frontend with MSAL sign-in bypassed. Defaults to PROD when unset,
# and is only useful alongside AUTH_DEV_BYPASS=true above.
# export ZOELIBRARYAPP_FRONTEND_ENV_TYPE="PROD"
