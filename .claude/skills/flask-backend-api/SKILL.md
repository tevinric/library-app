---
name: flask-backend-api
description: Use when writing or extending the Flask backend for an app in this house style — adding endpoints, handling database connections, error handling, activity logging, health checks, or configuring Gunicorn and the backend Dockerfile. Covers the single-file app.py layout, the standard CRUD route pattern, parameterised SQL, and the JSON/Decimal and CORS setup.
---

# Flask backend conventions

The whole API lives in one `backend/app.py`, sectioned with banner comments.
At this scale that beats a package tree: every route is greppable and the
read order matches the request lifecycle.

## File order

```python
# imports, load_dotenv(), logging, app = Flask(__name__)
# JSON provider (Decimal support)
# CORS configuration
# ===== DATABASE CONNECTION =====
# ===== STARTUP MIGRATIONS =====      run_migrations() called at import time
# ===== HELPER FUNCTIONS =====        sanitize_input, id generators, shared queries
# ===== AUTHENTICATION =====          token_required — see secure-entra-app-auth
# ===== ACTIVITY LOG =====            @app.after_request
# ===== HEALTH CHECK =====
# ===== PUBLIC ENDPOINTS =====        /api/public/* — explicitly unauthenticated
# ===== {ENTITY} ENDPOINTS =====      one block per domain entity
# ===== DASHBOARD / STATS =====
# ===== ERROR HANDLERS =====
# ===== MAIN =====
```

## Database access

One connection per handler, opened and closed inside it. No global connection,
no pool — Gunicorn gives you process-level concurrency and Postgres handles
the connection churn fine at this scale.

```python
def get_db_connection():
    """Create and return a database connection with RealDictCursor."""
    return psycopg2.connect(
        host=os.getenv('{APPNAME}_DB_HOST'),
        port=os.getenv('{APPNAME}_DB_PORT'),
        database=os.getenv('{APPNAME}_DB_NAME'),
        user=os.getenv('{APPNAME}_DB_USER'),
        password=os.getenv('{APPNAME}_DB_PASSWORD'),
        cursor_factory=RealDictCursor
    )
```

`RealDictCursor` is what makes `jsonify(rows)` work directly — rows come back
as dicts, not tuples.

## The standard route pattern

Every endpoint has the same skeleton. Follow it exactly; the consistency is
the point.

```python
@app.route('/api/{entities}', methods=['GET'])
@token_required
def get_{entities}():
    """One-line description."""
    try:
        search = request.args.get('search', '').strip()
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('''
            SELECT e.*, COUNT(DISTINCT c.id) as related_count
            FROM {entities} e
            LEFT JOIN {children} c ON e.id = c.{entity}_id
            WHERE LOWER(e.name) LIKE LOWER(%s)
            GROUP BY e.id
            ORDER BY e.created_at DESC, e.id ASC
        ''', (f'%{search}%',))

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(rows)

    except Exception as e:
        logger.error(f"Error fetching {entities}: {str(e)}")
        return jsonify({'error': str(e)}), 500
```

Rules inside that shape:

- **`@token_required` on everything** except `/api/health` and explicit
  `/api/public/*` routes. Adding a route without it is the default bug.
- **Parameterised SQL, always.** Values go in the `%s` tuple, never into an
  f-string. Where a query is built conditionally, build a `where_clauses` list
  and a parallel `params` list, and only interpolate the *structure*:
  ```python
  where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ''
  ```
  Interpolating a value there is a SQL injection; interpolating clause
  fragments you wrote yourself is fine.
- **Lists sort `ORDER BY created_at DESC` with a deterministic tiebreak** —
  newest first is the house default, and a second key stops rows shuffling
  between loads when timestamps collide.
- **`RETURNING *` on INSERT/UPDATE**, and return the row. The frontend
  frequently needs the generated ID immediately.
- **`conn.commit()` on writes**, then close cursor and connection.
- **Log the real error, return a safe one.** `logger.error` gets the detail;
  the client gets a short message. Returning `str(e)` on a 500 is acceptable
  for internal-only apps but never for anything that touches auth.
- **Cap and floor user-supplied paging**:
  ```python
  limit = min(int(request.args.get('limit', 100)), 500)
  offset = max(int(request.args.get('offset', 0)), 0)
  ```

## Input sanitising

Empty form fields arrive as `''`, which Postgres rejects for numeric columns.
One shared helper handles it:

```python
def sanitize_input(value, field_type='str'):
    """Convert empty strings to None; coerce numeric fields safely."""
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
```

## JSON and Decimal

`NUMERIC` columns come back as `Decimal`, which Flask's default encoder can't
serialize. Install a provider once:

```python
class DecimalSafeJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

app.json = DecimalSafeJSONProvider(app)
```

Datetimes are serialized by Flask as RFC-1123 strings, which `new Date()`
parses correctly in the browser. No custom handling needed.

## CORS

Scope it to the API and to known origins. In production the frontend is
same-origin (nginx proxies `/api`), so this matters mainly for local dev:

```python
CORS(app, resources={
    r"/api/*": {
        "origins": [f"http://localhost:{os.getenv('{APPNAME}_FRONTEND_PORT', '3002')}"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

CORS is a browser convenience, not a security control — it stops other sites'
JavaScript reading responses, and stops nothing else. The auth check is what
protects the route.

## Activity log

Every authenticated request is recorded, via one `after_request` hook:

```python
@app.after_request
def log_activity(response):
    if not getattr(g, 'user_email', None):
        return response          # health, public routes, failed auth, OPTIONS
    ...                          # insert into activity_log
    return response
```

Deliberate choices: it logs only when `token_required` set `g.user_email`, so
unauthenticated traffic can't flood the table; it truncates the request body
(1000 chars) and error message (500); it takes the client IP from
`X-Forwarded-For` (first hop) since the app sits behind a proxy; and a logging
failure is caught and swallowed so it can never break the real response.

## Health check

Must actually touch the database — a health check that only proves Flask is
running will report healthy while every request 500s:

```python
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close(); conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503
```

## Public endpoints

Anything under `/api/public/` is deliberately unauthenticated and needs a
column-by-column review before it ships. Select named columns — never
`SELECT *` — and confirm no join drags in user, borrower, or transaction data:

```python
@app.route('/api/public/{entities}', methods=['GET'])
def get_public_{entities}():
    """Public endpoint: safe fields only. No user IDs, no personal data."""
```

## Error handlers

```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500
```

Both return JSON — an API that returns Flask's HTML error page breaks the
frontend's error handling.

## Gunicorn

`backend/gunicorn_config.py`:

```python
bind = f"0.0.0.0:{os.getenv('{APPNAME}_BACKEND_PORT', '5002')}"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
timeout = 30
max_requests = 1000          # recycle workers to bound memory growth
max_requests_jitter = 50     # stagger the recycling
accesslog = '-'              # stdout, so docker logs sees it
errorlog = '-'
loglevel = 'info'
proc_name = '{app}_backend'
```

Remember every worker imports `app.py` independently — which is why
`run_migrations()` needs its advisory lock.

## Dockerfile

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y \
    gcc libpq-dev postgresql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE {BACKEND_PORT}
CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]
```

`postgresql-client` is included so `pg_dump`/`psql` are available inside the
container for backup and debugging. Requirements are copied and installed
before the app code so dependency layers cache across code changes.

## requirements.txt

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

Pin exact versions. `PyJWT` + `cryptography` are what verify Entra tokens —
see `secure-entra-app-auth`.
