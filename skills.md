---
description: Full-stack app blueprint — Flask + React + PostgreSQL + Docker Compose. Use when building a new app from scratch in the established codebase style.
argument-hint: App name and brief description (e.g. "budget-tracker — tracks monthly household expenses")
---

# App Build Blueprint

You are building a new full-stack application following an established architecture. This skill encodes every decision made in the existing codebase — naming conventions, file structure, styling system, auth pattern, Docker Compose setup, and environment variable management. Follow it exactly unless the user explicitly overrides a section.

**User's app request**: $ARGUMENTS

---

## Phase 1 — Clarify Requirements

Before writing a single file, ask the user:

1. **App name** — used as the `APPNAME` prefix throughout (e.g. `BUDGETTRACKER`, `CRMDASH`). Must be UPPERCASE, letters only, no spaces or hyphens.
2. **Domain entities** — what are the main data objects? (e.g. "transactions, categories, budgets")
3. **Auth mode** — Azure AD (PROD) or dev-bypass only? If Azure AD, do they have a tenant/client ID?
4. **Port assignment** — backend port (default: 5002) and frontend port (default: 3002). Use different ports if multiple apps run on same host.
5. **Public endpoints** — any pages/endpoints accessible without login?
6. **External API integrations** — any third-party APIs to call?

Wait for answers. Do not generate code until all six points are confirmed.

---

## Phase 2 — Project Structure

Every app uses this exact directory layout:

```
{app-name}/
├── backend/
│   ├── app.py                  # Single Flask file — all routes
│   ├── Dockerfile
│   ├── gunicorn_config.py
│   └── requirements.txt
├── database/
│   └── sql_init.sql            # Schema run on first postgres startup
├── frontend/
│   ├── Dockerfile              # Multi-stage: node build → nginx serve
│   ├── nginx.conf              # SPA routing + /api proxy
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── .env                    # GITIGNORED — real values
│   ├── env_sample_frontend     # Tracked — empty values, shows structure
│   └── src/
│       ├── main.jsx            # MSAL init + BrowserRouter + MsalProvider
│       ├── App.jsx             # Auth gating + sidebar + route declarations
│       ├── App.css             # Custom Tailwind component classes
│       ├── index.css           # Global base styles + scrollbar
│       ├── api.js              # Axios instance + all API functions
│       ├── authConfig.js       # MSAL config from env vars
│       ├── components/
│       │   └── Icons.jsx       # All SVG icons as named exports
│       └── pages/
│           ├── Dashboard.jsx   # Stats grid + quick actions
│           └── {Entity}.jsx    # One file per feature/entity
├── backups/
│   └── .gitkeep
├── scripts/
│   └── postgresql_backup.sh
├── docker-compose.yml
├── env_sample                  # Tracked — shows all backend env vars (empty)
├── env_sample.sh               # Tracked — shell export version (empty values)
├── env.sh                      # GITIGNORED — real shell exports
├── setup.sh                    # First-run setup script
├── .gitignore
└── README.md
```

---

## Phase 3 — Naming Conventions

This is the most important convention. Every identifier is namespaced to prevent collisions when multiple apps run on the same host.

### APPNAME Prefix

Pick a short, ALL-CAPS identifier from the app name (no spaces, no hyphens):
- `budget-tracker` → `BUDGETTRACKER`
- `crm-dashboard` → `CRMDASH`
- `inventory-app` → `INVENTORY`

### Backend Environment Variables

All backend env vars use the pattern `{APPNAME}_{DESCRIPTOR}`:

```bash
# Database
{APPNAME}_DB_HOST=postgres_{appname}   # matches container name
{APPNAME}_DB_PORT=5432
{APPNAME}_DB_NAME={appname}_db
{APPNAME}_DB_USER={appname}user
{APPNAME}_DB_PASSWORD=change_this

# Ports
{APPNAME}_FRONTEND_PORT=3002
{APPNAME}_BACKEND_PORT=5002

# Flask
{APPNAME}_SECRET_KEY=change-this-secret-key
{APPNAME}_FLASK_ENV=production

# Azure AD (optional)
{APPNAME}_AZURE_TENANT_ID=
{APPNAME}_AZURE_CLIENT_ID=
{APPNAME}_AZURE_REQUIRED_GROUP_ID=
```

### Frontend Environment Variables

All frontend env vars use `VITE_{APPNAME}_{DESCRIPTOR}` (Vite requires `VITE_` prefix):

```bash
VITE_{APPNAME}_ENV_TYPE=PROD          # DEV or PROD
VITE_{APPNAME}_AZURE_CLIENT_ID=
VITE_{APPNAME}_AZURE_TENANT_ID=
VITE_{APPNAME}_AZURE_REDIRECT_URI=http://localhost:3002
VITE_{APPNAME}_AZURE_POST_LOGOUT_REDIRECT_URI=http://localhost:3002
VITE_{APPNAME}_API_URL=http://localhost:5002
VITE_{APPNAME}_DEV_PORT=3002
VITE_{APPNAME}_DEV_USER_EMAIL=dev@{appname}.local
```

### Docker Identifiers

| Resource | Pattern | Example (budgettracker) |
|---|---|---|
| Postgres container | `postgres_{appname}` | `postgres_budgettracker` |
| Backend container | `{appname}_backend` | `budgettracker_backend` |
| Frontend container | `{appname}_frontend` | `budgettracker_frontend` |
| Docker volume | `{appname}_data` | `budgettracker_data` |
| Docker network | `{appname}_network` | `budgettracker_network` |

---

## Phase 4 — Docker Compose

Generate this exact structure. Substitute `{APPNAME}`, `{appname}`, `{BACKEND_PORT}`, `{FRONTEND_PORT}`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: postgres_{appname}
    environment:
      POSTGRES_DB: ${APPNAME_DB_NAME}
      POSTGRES_USER: ${APPNAME_DB_USER}
      POSTGRES_PASSWORD: ${APPNAME_DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    volumes:
      - {appname}_data:/var/lib/postgresql/data
      - ./database/sql_init.sql:/docker-entrypoint-initdb.d/sql_init.sql
      - ./backups:/backups
    ports:
      - "5433:5432"       # Use non-standard host port to avoid conflicts
    restart: unless-stopped
    networks:
      - {appname}_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${APPNAME_DB_USER} -d ${APPNAME_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: {appname}_backend
    ports:
      - "${APPNAME_BACKEND_PORT:-{BACKEND_PORT}}:{BACKEND_PORT}"
    environment:
      - {APPNAME}_DB_HOST=${APPNAME_DB_HOST}
      - {APPNAME}_DB_PORT=${APPNAME_DB_PORT}
      - {APPNAME}_DB_NAME=${APPNAME_DB_NAME}
      - {APPNAME}_DB_USER=${APPNAME_DB_USER}
      - {APPNAME}_DB_PASSWORD=${APPNAME_DB_PASSWORD}
      - {APPNAME}_SECRET_KEY=${APPNAME_SECRET_KEY}
      - {APPNAME}_FLASK_ENV=${APPNAME_FLASK_ENV:-production}
      - {APPNAME}_BACKEND_PORT={BACKEND_PORT}
      - {APPNAME}_AZURE_TENANT_ID=${APPNAME_AZURE_TENANT_ID}
      - {APPNAME}_AZURE_CLIENT_ID=${APPNAME_AZURE_CLIENT_ID}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - {appname}_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: {appname}_frontend
    ports:
      - "${APPNAME_FRONTEND_PORT:-{FRONTEND_PORT}}:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - {appname}_network

volumes:
  {appname}_data:
    driver: local
    name: {appname}_data

networks:
  {appname}_network:
    driver: bridge
    name: {appname}_network
```

**Key rules:**
- Postgres always maps to host port **5433** (not 5432) to avoid clashing with any local Postgres.
- Backend and frontend host ports come from env vars with hardcoded defaults.
- Backend and frontend are on the same named network so nginx can proxy by container name.
- `depends_on` with `condition: service_healthy` means backend will not start until Postgres responds to `pg_isready`.

---

## Phase 5 — Database Schema (sql_init.sql)

Every schema follows this exact template. All tables get UUIDs, user ownership, timestamps, and update triggers.

```sql
-- Enable UUID extension (required)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE (required in every app)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION (apply to every table)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- DOMAIN TABLES (repeat pattern below for each entity)
-- =============================================================================
CREATE TABLE IF NOT EXISTS {entity} (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- domain-specific columns here
    -- use CHECK constraints for enum-style columns:
    -- status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_{entity}_updated_at ON {entity};
CREATE TRIGGER update_{entity}_updated_at
    BEFORE UPDATE ON {entity}
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index every FK and every column used in WHERE clauses
CREATE INDEX IF NOT EXISTS idx_{entity}_user_id ON {entity}(user_id);
-- CREATE INDEX IF NOT EXISTS idx_{entity}_status ON {entity}(status);
```

**Schema rules:**
- Primary key is always `UUID` via `uuid_generate_v4()`.
- Every domain table has `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` — data is always user-scoped.
- Every table has `created_at` and `updated_at` with the shared trigger.
- Enum-style columns use `CHECK (column IN (...))` constraints, not separate lookup tables.
- Index every FK column, status/enum column, and any column used in text searches.
- Use `IF NOT EXISTS` on all `CREATE TABLE`, `CREATE INDEX`, and `DROP TRIGGER IF EXISTS` so the script is safely re-runnable.

---

## Phase 6 — Backend (app.py)

Single Flask file. All routes in one file, organized with section comment headers. No blueprints unless the app exceeds ~15 endpoints.

### requirements.txt

```
Flask==3.0.0
Flask-CORS==4.0.0
gunicorn==21.2.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
PyJWT==2.8.0
cryptography==41.0.7
requests==2.31.0
```

### Dockerfile (backend)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE {BACKEND_PORT}

CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]
```

### gunicorn_config.py

```python
import os
import multiprocessing

bind = f"0.0.0.0:{os.getenv('{APPNAME}_BACKEND_PORT', '{BACKEND_PORT}')}"
backlog = 2048

workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

max_requests = 1000
max_requests_jitter = 50
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

accesslog = '-'
errorlog = '-'
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

proc_name = '{appname}_backend'
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None
```

### app.py structure

```python
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('{APPNAME}_SECRET_KEY', 'dev-secret-key')

CORS(app, resources={
    r"/api/*": {
        "origins": [
            f"http://localhost:{os.getenv('{APPNAME}_FRONTEND_PORT', '{FRONTEND_PORT}')}",
            "http://localhost:3000",
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-User-Email"]
    }
})

# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('{APPNAME}_DB_HOST'),
        port=os.getenv('{APPNAME}_DB_PORT'),
        database=os.getenv('{APPNAME}_DB_NAME'),
        user=os.getenv('{APPNAME}_DB_USER'),
        password=os.getenv('{APPNAME}_DB_PASSWORD'),
        cursor_factory=RealDictCursor
    )

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def sanitize_input(value, field_type='str'):
    if value == '' or value is None:
        return None
    if field_type == 'int':
        try:
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
    elif field_type in ('float', 'decimal'):
        try:
            return float(value) if value else None
        except (ValueError, TypeError):
            return None
    return value

# =============================================================================
# AUTHENTICATION
# =============================================================================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        email = request.headers.get('X-User-Email')
        if not email:
            return jsonify({'error': 'Authentication required'}), 401
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT id, email FROM users WHERE email = %s', (email,))
            user = cur.fetchone()
            if not user:
                cur.execute(
                    'INSERT INTO users (email, username) VALUES (%s, %s) RETURNING id, email',
                    (email, email.split('@')[0])
                )
                user = cur.fetchone()
                conn.commit()
            g.user_id = user['id']
            g.user_email = user['email']
            cur.close()
            conn.close()
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 401
    return decorated

# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# =============================================================================
# PUBLIC ENDPOINTS (no auth)
# =============================================================================

# @app.route('/api/public/...', methods=['GET'])

# =============================================================================
# USER ENDPOINTS
# =============================================================================

@app.route('/api/user', methods=['GET'])
@token_required
def get_current_user():
    return jsonify({'id': str(g.user_id), 'email': g.user_email})

# =============================================================================
# {ENTITY} ENDPOINTS  ← repeat this block per domain entity
# =============================================================================

@app.route('/api/{entities}', methods=['GET'])
@token_required
def get_{entities}():
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()
        # query using str(g.user_id) for user scoping
        # always use parameterized %s, never f-strings in SQL
        items = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(items)
    except Exception as e:
        logger.error(f"Error fetching {entities}: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ... GET one, POST, PUT, DELETE follow the same pattern

# =============================================================================
# DASHBOARD / STATS
# =============================================================================

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    # Run individual COUNT queries, return single dict
    pass

# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    port = int(os.getenv('{APPNAME}_BACKEND_PORT', '{BACKEND_PORT}'))
    app.run(host='0.0.0.0', port=port,
            debug=os.getenv('{APPNAME}_FLASK_ENV') == 'development')
```

**Backend rules:**
- Every route uses `@token_required` except health check and explicitly public endpoints.
- User scoping: all queries filter by `WHERE ... AND user_id = %s` with `str(g.user_id)`.
- Every route opens its own connection, closes it before returning — no connection pooling.
- `RealDictCursor` means `cur.fetchall()` returns list of dicts — pass directly to `jsonify()`.
- SQL always uses `%s` placeholders. Never f-strings or `.format()` in SQL strings.
- Success responses: `jsonify(item)` (200), `jsonify(item), 201` (created), `jsonify({'message': '...'})` (deleted).
- Error responses: `jsonify({'error': str(e)}), 500` or `jsonify({'error': 'X not found'}), 404`.
- Validate preconditions (e.g. "can't delete if active") before the main operation; return 400 with clear message.
- RETURNING `*` on INSERT and UPDATE — return the created/updated row directly.
- Organize with `# === ... ===` section headers, alphabetical within each section.

---

## Phase 7 — Frontend Setup

### package.json dependencies

```json
{
  "dependencies": {
    "@azure/msal-browser": "^3.7.0",
    "@azure/msal-react": "^2.0.0",
    "axios": "^1.6.2",
    "date-fns": "^3.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.45.0",
    "eslint-plugin-react": "^7.32.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.8"
  }
}
```

### vite.config.js

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_{APPNAME}_DEV_PORT) || 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_{APPNAME}_API_URL || 'http://localhost:{BACKEND_PORT}',
        changeOrigin: true,
      }
    }
  }
})
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://{appname}_backend:{BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

The `proxy_pass` uses the backend **container name** — nginx resolves it via Docker's internal DNS on the shared network.

### Dockerfile (frontend)

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## Phase 8 — Authentication (authConfig.js + main.jsx + App.jsx)

### authConfig.js

```js
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_{APPNAME}_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_{APPNAME}_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_{APPNAME}_AZURE_REDIRECT_URI || 'http://localhost:{FRONTEND_PORT}',
    postLogoutRedirectUri: import.meta.env.VITE_{APPNAME}_AZURE_POST_LOGOUT_REDIRECT_URI || 'http://localhost:{FRONTEND_PORT}',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  }
}

export const loginRequest = {
  scopes: ['User.Read']
}
```

### main.jsx

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import App from './App.jsx'
import { msalConfig } from './authConfig.js'
import './index.css'

const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.initialize().then(() => {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
  }
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
      msalInstance.setActiveAccount(event.payload.account)
    }
  })
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>,
  )
})
```

### App.jsx auth gating pattern

```jsx
const ENV_TYPE = import.meta.env.VITE_{APPNAME}_ENV_TYPE || 'PROD'
const IS_DEV_MODE = ENV_TYPE === 'DEV'
const DEV_USER_EMAIL = import.meta.env.VITE_{APPNAME}_DEV_USER_EMAIL || 'dev@{appname}.local'

// In useEffect:
if (IS_DEV_MODE) {
  localStorage.setItem('userEmail', DEV_USER_EMAIL)
  setCurrentUser({ email: DEV_USER_EMAIL, username: 'Dev User' })
  setIsAuthorized(true)
  setIsLoading(false)
  return
}
// else: Azure AD MSAL flow
```

**Auth rules:**
- DEV mode bypasses all Azure AD — set `VITE_{APPNAME}_ENV_TYPE=DEV` for local development.
- PROD mode uses MSAL popup login — never redirect, always popup.
- User email stored in `localStorage` as `userEmail`. Access token stored as `accessToken`.
- On 401 from API: clear both localStorage keys, reload page.
- Show a DEV MODE badge in the sidebar when `IS_DEV_MODE` is true.
- Public pages (if any) are routed before the auth gate: check `location.pathname` before the loading/auth checks.

---

## Phase 9 — API Layer (api.js)

```js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_{APPNAME}_API_URL || 'http://localhost:{BACKEND_PORT}'),
})

api.interceptors.request.use((config) => {
  const userEmail = localStorage.getItem('userEmail')
  if (userEmail) {
    config.headers['X-User-Email'] = userEmail
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('userEmail')
      localStorage.removeItem('accessToken')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

// Named exports for every endpoint:
export const healthCheck = () => api.get('/api/health')
export const getCurrentUser = () => api.get('/api/user')
export const getDashboardStats = () => api.get('/api/dashboard/stats')

// Per-entity:
export const get{Entities} = (search = '') => api.get('/api/{entities}', { params: { search } })
export const get{Entity} = (id) => api.get(`/api/{entities}/${id}`)
export const create{Entity} = (data) => api.post('/api/{entities}', data)
export const update{Entity} = (id, data) => api.put(`/api/{entities}/${id}`, data)
export const delete{Entity} = (id) => api.delete(`/api/{entities}/${id}`)

export default api
```

**API layer rules:**
- One `axios` instance with interceptors — never import `axios` directly in page components.
- `baseURL` is empty string in production (nginx handles `/api` proxy) and points to backend in dev.
- Every function is a named export — import individually in pages.
- Functions match backend routes 1:1: same path, same params.

---

## Phase 10 — Styling System

### tailwind.config.js

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63',
        },
        success: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
```

### index.css (global base)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-900 text-gray-100;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { @apply bg-gray-800; }
::-webkit-scrollbar-thumb { @apply bg-gray-600 rounded; }
::-webkit-scrollbar-thumb:hover { @apply bg-gray-500; }

input, select, textarea {
  @apply bg-gray-700 border-gray-600 text-white rounded-lg;
}
input:focus, select:focus, textarea:focus {
  @apply border-primary-500 ring-1 ring-primary-500 outline-none;
}

table { @apply w-full; }
th { @apply bg-gray-800 text-left px-4 py-3 text-gray-300 font-semibold; }
td { @apply px-4 py-3 border-t border-gray-700; }
tr:hover td { @apply bg-gray-800/50; }
```

### App.css (reusable component classes)

```css
/* Sidebar */
.sidebar-link {
  @apply flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700/50 hover:text-white rounded-lg transition-all duration-200 font-medium;
}
.sidebar-link.active {
  @apply bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/20;
}

/* Buttons */
.btn-primary {
  @apply px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg hover:from-primary-700 hover:to-primary-600 transition-all duration-200 font-semibold shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5;
}
.btn-secondary {
  @apply px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5;
}
.btn-success {
  @apply px-6 py-3 bg-gradient-to-r from-success-600 to-success-500 text-white rounded-lg hover:from-success-700 hover:to-success-600 transition-all duration-200 font-semibold shadow-lg shadow-success-500/30 hover:shadow-xl hover:shadow-success-500/40 hover:-translate-y-0.5;
}
.btn-danger {
  @apply px-6 py-3 bg-gradient-to-r from-danger-600 to-danger-500 text-white rounded-lg hover:from-danger-700 hover:to-danger-600 transition-all duration-200 font-semibold shadow-lg shadow-danger-500/30 hover:shadow-xl hover:shadow-danger-500/40 hover:-translate-y-0.5;
}

/* Cards */
.card {
  @apply bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-xl p-6 shadow-xl border border-gray-700/50 backdrop-blur-sm;
}
.stat-card {
  @apply bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-xl p-3 shadow-lg border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 cursor-pointer hover:-translate-y-0.5;
}
@screen sm { .stat-card { @apply p-4; } }

/* Stat tile icon */
.stat-icon {
  @apply w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md flex-shrink-0;
}
@screen sm { .stat-icon { @apply w-10 h-10; } }

/* Modals */
.modal-overlay {
  @apply fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in;
}
.modal-content {
  @apply bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/50 animate-slide-up;
  margin-left: 0.75rem;
  margin-right: 0.75rem;
}
@screen sm { .modal-content { @apply p-6; margin-left: 1rem; margin-right: 1rem; } }

/* Login */
.login-container {
  @apply relative bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 p-10 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-sm;
}
.login-container::before {
  content: '';
  @apply absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent rounded-2xl pointer-events-none;
}

/* Utility */
.icon-circle {
  @apply w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg;
}
.gradient-text {
  @apply bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent;
}
.stat-number {
  @apply text-xl font-bold bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent;
}
@screen sm { .stat-number { @apply text-2xl; } }

/* Alerts */
.alert-danger {
  @apply bg-gradient-to-r from-danger-900/40 to-danger-800/40 border border-danger-500/50 rounded-xl p-4 backdrop-blur-sm;
}
.alert-warning {
  @apply bg-gradient-to-r from-warning-900/40 to-warning-800/40 border border-warning-500/50 rounded-xl p-4 backdrop-blur-sm;
}
.alert-success {
  @apply bg-gradient-to-r from-success-900/40 to-success-800/40 border border-success-500/50 rounded-xl p-4 backdrop-blur-sm;
}
```

### Color semantic usage

| Color | Use for |
|---|---|
| `primary` (cyan) | Main actions, active nav, links, stat numbers |
| `success` (green) | Positive states, "available", confirmed checkouts |
| `warning` (amber) | Caution states, pending items, watchlist |
| `danger` (red) | Errors, delete actions, overdue items |
| `gray-900` | Page background |
| `gray-800` | Card/sidebar background |
| `gray-700` | Input background, secondary cards |
| `gray-300-400` | Secondary text |
| `white` | Primary text, icon colors on colored backgrounds |

---

## Phase 11 — Page Component Pattern

Every page follows this exact structure:

```jsx
import { useState, useEffect } from 'react'
import { get{Entities}, create{Entity}, update{Entity}, delete{Entity} } from '../api'
import { EditIcon, TrashIcon, PlusIcon } from '../components/Icons'

function {EntityName}Page() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({ /* fields */ })

  useEffect(() => { loadItems() }, [search])

  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await get{Entities}(search)
      setItems(response.data)
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (editingItem) {
        await update{Entity}(editingItem.id, formData)
      } else {
        await create{Entity}(formData)
      }
      setShowModal(false)
      setEditingItem(null)
      setFormData({ /* reset */ })
      loadItems()
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{Page Title}</h1>
          <p className="text-gray-400 mt-1">{Subtitle}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          Add Item
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..." className="w-full px-4 py-2" />
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-400">No items found</p>
        </div>
      ) : (
        <div className="card">
          {items.map((item) => (
            <div key={item.id} className="bg-gray-700 rounded-lg p-4">
              {/* item content */}
              <div className="flex gap-2">
                <button onClick={() => handleEdit(item)} className="btn-secondary text-sm flex items-center gap-2">
                  <EditIcon className="w-4 h-4" /><span>Edit</span>
                </button>
                <button onClick={() => handleDelete(item.id)} className="btn-danger text-sm flex items-center gap-2">
                  <TrashIcon className="w-4 h-4" /><span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingItem ? 'Edit Item' : 'New Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* form fields */}
              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="btn-primary">
                  {editingItem ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default {EntityName}Page
```

### Dashboard stat tile pattern

```jsx
<Link to="/route" className="stat-card group">
  <div className="flex items-center gap-3">
    <div className="stat-icon from-primary-500 to-primary-600">
      <SomeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Label</p>
      <p className="stat-number leading-tight mt-0.5">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Subtitle</p>
    </div>
  </div>
</Link>
```

Use `from-primary-500 to-primary-600` for default tiles, `from-success-500 to-success-600` for positive, `from-danger-500 to-danger-600` for alerts, `from-warning-500 to-warning-600` for caution.

---

## Phase 12 — Icons (Icons.jsx)

Use inline SVG components — no external icon libraries. All icons accept a `className` prop defaulting to `"w-5 h-5"`. Always `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`.

```jsx
export const {Name}Icon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
)
```

Standard icons to always include: `DashboardIcon`, `SearchIcon`, `PlusIcon`, `EditIcon`, `TrashIcon`, `XIcon`, `CheckIcon`, `LogoutIcon`, `MicrosoftIcon`, `AlertIcon`, `ClockIcon`, `TrendingUpIcon`.

---

## Phase 13 — App Shell (App.jsx)

The App.jsx manages:
1. Auth gating (DEV bypass or MSAL)
2. Sidebar layout with navigation items
3. Route declarations
4. Mobile hamburger menu

**Sidebar structure:**
- Fixed on desktop (`lg:static`), slide-in on mobile (`fixed inset-y-0 z-50`)
- Logo + app name in header section with `gradient-text`
- Nav links using `.sidebar-link` and `.sidebar-link.active` based on `location.pathname`
- Current user email displayed below logo
- Sign out button at bottom with `LogoutIcon`

**Layout structure:**
```jsx
<div className="min-h-screen bg-gray-900 flex">
  <aside className="fixed ... lg:static w-64 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/50">
    {/* logo, nav, logout */}
  </aside>
  <div className="flex-1 flex flex-col min-h-screen">
    <header className="lg:hidden ..."> {/* mobile header with hamburger */} </header>
    <main className="flex-1 p-4 lg:p-8 overflow-auto">
      <Routes>...</Routes>
    </main>
  </div>
  {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={close} />}
</div>
```

---

## Phase 14 — Environment Files

### .gitignore (required entries)

```gitignore
node_modules/
__pycache__/
*.pyc
.venv/
venv/
.env
env.sh          # contains real secrets
dist/
build/
*.egg-info/
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
*.log
coverage/
.pytest_cache/
backups/*.sql
backups/*.sql.gz
backups/*.tar.gz
```

### File strategy

| File | Tracked? | Contains |
|---|---|---|
| `env_sample` | Yes | Backend var names, empty values |
| `env_sample.sh` | Yes | Shell export format, empty values |
| `.env` | **No** | Real backend secrets for Docker Compose |
| `env.sh` | **No** | Real shell exports for running locally |
| `frontend/.env` | **No** | Real frontend secrets |
| `frontend/env_sample_frontend` | Yes | Frontend var names, empty values |

The `.env` file at project root is consumed by `docker-compose.yml` automatically. The `env.sh` shell script is sourced when running services directly (not via Docker). Always maintain both — they mirror each other in variable names but have different syntax (`KEY=value` vs `export KEY="value"`).

---

## Phase 15 — Setup Script (setup.sh)

```bash
#!/bin/bash

echo "========================================"
echo "{App Name} - Setup Script"
echo "========================================"

command -v docker &>/dev/null || { echo "Docker not installed"; exit 1; }
command -v docker-compose &>/dev/null || { echo "Docker Compose not installed"; exit 1; }

[ ! -f .env ] && { echo ".env file not found. Copy env_sample to .env and fill in values."; exit 1; }

echo "Building and starting services..."
docker-compose build
docker-compose up -d

echo ""
echo "========================================"
echo "Application URLs:"
echo "  Frontend: http://localhost:{FRONTEND_PORT}"
echo "  Backend:  http://localhost:{BACKEND_PORT}"
echo "  Health:   http://localhost:{BACKEND_PORT}/api/health"
echo "========================================"
echo "Commands:"
echo "  Logs:    docker-compose logs -f"
echo "  Stop:    docker-compose down"
echo "  Restart: docker-compose restart"
echo "========================================"
```

---

## Phase 16 — Implementation Order

Generate files in this order to avoid dependency issues:

1. `database/sql_init.sql` — schema first, drives all else
2. `docker-compose.yml`
3. `.gitignore`
4. `env_sample` + `env_sample.sh` + `frontend/env_sample_frontend`
5. `backend/requirements.txt`
6. `backend/gunicorn_config.py`
7. `backend/Dockerfile`
8. `backend/app.py`
9. `frontend/package.json`
10. `frontend/tailwind.config.js` + `frontend/postcss.config.js`
11. `frontend/vite.config.js`
12. `frontend/nginx.conf`
13. `frontend/Dockerfile`
14. `frontend/index.html`
15. `frontend/src/index.css`
16. `frontend/src/App.css`
17. `frontend/src/components/Icons.jsx`
18. `frontend/src/authConfig.js`
19. `frontend/src/api.js`
20. `frontend/src/pages/Dashboard.jsx`
21. `frontend/src/pages/{Entity}.jsx` — one per domain entity
22. `frontend/src/App.jsx`
23. `frontend/src/main.jsx`
24. `setup.sh`

After generating all files, tell the user:
1. Copy `env_sample` to `.env` and fill in real values
2. Copy `frontend/env_sample_frontend` to `frontend/.env` and fill in values
3. Set `VITE_{APPNAME}_ENV_TYPE=DEV` in `frontend/.env` for local dev without Azure AD
4. Run `docker-compose build && docker-compose up -d`
5. Check health: `curl http://localhost:{BACKEND_PORT}/api/health`

---

## Quick Reference Checklist

Before declaring the app done, verify:

- [ ] All env vars in `docker-compose.yml` match the `env_sample` file
- [ ] `{APPNAME}_DB_HOST` in `env_sample` equals the postgres container name
- [ ] nginx `proxy_pass` uses the backend **container name**, not `localhost`
- [ ] Backend routes filter by `user_id = str(g.user_id)` — never return cross-user data
- [ ] SQL uses `%s` parameterization throughout — no string formatting in queries
- [ ] `sql_init.sql` has `IF NOT EXISTS` on every `CREATE` statement
- [ ] Every domain table has the `update_updated_at_column()` trigger
- [ ] Vite proxy in `vite.config.js` points to the backend port
- [ ] CORS origins in `app.py` include the frontend port from env var
- [ ] `frontend/.env` is in `.gitignore`
- [ ] `env.sh` is in `.gitignore`
- [ ] DEV mode badge shows in sidebar when `IS_DEV_MODE` is true
- [ ] Health check endpoint tests actual DB connection
- [ ] `gunicorn_config.py` reads port from env var
