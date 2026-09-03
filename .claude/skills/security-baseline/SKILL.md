---
name: security-baseline
description: Use when building any app in this house style, and as a review checklist before shipping or when auditing an existing app. Covers the cross-cutting security posture — never trusting client-asserted identity, parameterised SQL, secrets and environment hygiene, data minimisation and PII, public endpoint review, activity logging, fail-closed defaults, and error-message discipline. Pairs with secure-entra-app-auth, which covers authentication specifically.
---

# Security baseline

Authentication has its own skill (`secure-entra-app-auth`) because it's the
easiest thing to get catastrophically wrong. This one covers everything else,
plus the review pass.

## The governing principle

**Never trust anything the client asserts about itself.** A header, a body
field, a query parameter, a cookie the frontend set, a JWT payload you decoded
but didn't verify — all of it is attacker-controlled. The backend derives
identity from a cryptographically verified token and from nothing else.

The reference app previously authenticated by reading an `X-User-Email` header
and believing it. Any caller could impersonate anyone with one `curl` flag.
That's the failure mode this whole baseline exists to prevent, and it is worth
knowing it shipped in a real app before someone looked.

Corollaries:

- Client-side checks are UX, never a security boundary. Hiding a button hides
  nothing — the endpoint is still reachable.
- Every route is authenticated unless it's deliberately, reviewably public.
- Authorisation decisions use claims from the verified token, or state the
  server owns. Never a value the request supplied.

## SQL

- **Parameterise every value.** `cur.execute(sql, (value,))`. Never f-string a
  value into SQL, including "safe-looking" ones like integers from `request.args`.
- Building a query conditionally is fine — interpolate *clause fragments you
  wrote*, never user input:
  ```python
  where_clauses.append('LOWER(b.title) LIKE LOWER(%s)')
  params.append(f'%{search}%')
  where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ''
  ```
- Clamp anything that sizes a query: `min(int(limit), 500)`, `max(int(offset), 0)`.
- Use `ON DELETE CASCADE` deliberately — know what a user deletion removes.

## Secrets and environment

- **Anything `VITE_`-prefixed is public.** It is compiled into a JS bundle any
  visitor can read. Client IDs and tenant IDs belong there; secrets never do.
- A SPA is a **public client**. It cannot hold a client secret. If one exists
  on the app registration, that's a finding — remove it.
- `.env`, `env.sh`, and `frontend/.env` are gitignored. Templates
  (`env_sample`, `env_sample.sh`, `env_sample_frontend`) are tracked, with
  placeholder values only.
- `frontend/.dockerignore` must exclude `.env` and `.env.*`, or `COPY . .`
  bakes local dev config into a production image.
- Before any commit that touches config, check what's staged. A filename that
  looks innocuous can still carry a credential.
- Rotate `{APPNAME}_SECRET_KEY` and the database password out of their
  placeholder values before first deployment, not "later".

## Fail closed

- Defaults are the secure value: `AUTH_DEV_BYPASS:-false`,
  `FRONTEND_ENV_TYPE:-PROD`. A forgotten variable produces real auth, not a
  bypass.
- Refuse to start rather than start insecure. The backend raises at import if
  Entra config is missing and the dev bypass isn't explicitly on.
- Any dev bypass is gated by a flag **the server's own environment sets** —
  never by anything a request can influence. Document loudly that it must
  never be true anywhere reachable by others.
- The frontend's dev mode and the backend's bypass are two independent
  switches. A dev-mode frontend against a real backend gets blanket 401s,
  which is the correct failure.

## Data minimisation

The strongest control over personal data is not collecting it.

- Before adding a column that holds personal data, ask whether a generated
  opaque identifier would do. The reference app identifies borrowers by a
  random 8-character `borrower_id` and stores no name, email, or contact
  detail — a deliberate POPIA-driven decision, recorded in a dated migration
  and a `COMMENT ON COLUMN`.
- Where personal data is genuinely required, document why in the schema.
- Prefer stable opaque identifiers (`oid` from a token) over mutable
  human-readable ones (email, UPN) as keys — see `secure-entra-app-auth`.
- Backups inherit the sensitivity of the data. See `backup-and-restore`.

## Public endpoints

Anything under `/api/public/` bypasses auth by design and needs a
**column-by-column review** before it ships:

- Select named columns. Never `SELECT *` on a public route — a later `ALTER
  TABLE` silently widens what you expose.
- Check every join. The leak is usually a join that drags in user, borrower,
  or transaction rows, not the primary table.
- Ask what the aggregate reveals: counts and availability are usually fine;
  anything traceable to an individual is not.
- Public endpoints are deliberately excluded from the activity log, so they
  need rate-limiting thinking at the ingress layer instead.

## Logging and provenance

- Every domain table carries `user_id` — provenance is schema-level.
- Every authenticated request is recorded in `activity_log` with method, path,
  truncated body, status, and client IP from `X-Forwarded-For`.
- **Never log a token, password, or secret.** A bearer token is a live
  credential until it expires.
- Do log the diagnostic values that make failures debuggable — for a rejected
  token, the actual vs expected `iss`/`aud`, which are endpoint identifiers,
  not secrets.
- Unauthenticated traffic is not logged to the database, so failed auth can't
  flood the table. That means log rotation at the container/host level is
  where you catch a flood.

## Error messages

- **Log the detail, return something generic.** The client gets "Invalid or
  expired token"; the logs get which check failed.
- Never render a raw identity-provider error in your UI. AADSTS text names
  your tenant and app registration.
- Error handlers return JSON, not HTML, so the frontend can handle them.
- Don't leak existence: a lookup for someone else's row should behave the same
  as a lookup for a row that doesn't exist.

## Frontend safety

- **Never `dangerouslySetInnerHTML`, `eval`, or direct `innerHTML`.** React
  escapes interpolated values by default; these three are the ways out of that
  guarantee. If one is genuinely unavoidable, sanitise at the boundary and say
  why in a comment.
- Debug/verbose modes must be impossible in production, not merely off. Keeping
  `app.run(debug=...)` inside the `if __name__ == '__main__':` block achieves
  this structurally — Gunicorn imports the module and never executes it, so the
  debugger cannot be switched on by an environment variable in production.

## Dependencies and containers

- Pin exact versions in `requirements.txt`; commit `package-lock.json`.
- **Pin transitive dependencies that carry security weight.** `Flask` pulls
  `Werkzeug`, so an unpinned `Werkzeug` means the version you get depends on
  the day the image was built. Pin it explicitly.
- **Treat the crypto library as the highest-priority upgrade.** `cryptography`
  is what verifies token signatures — staleness there matters more than
  anywhere else in the tree.
- The frontend runtime image contains no Node, no source, no `node_modules` —
  multi-stage build, nginx serves `dist/` only.
- **Publish the minimum set of ports, bound to loopback where possible.** The
  backend needs no host port at all — nginx reaches it over the compose
  network by container name. Postgres, if published for admin access, binds to
  `127.0.0.1:5433:5432`.
- **Docker's iptables rules bypass UFW.** A published container port can be
  reachable from the internet even when `ufw status` shows the port denied.
  Never treat a host firewall as sufficient protection for a published port —
  don't publish it, or bind it to loopback. Verify from **outside** the host,
  never from on it.
- Keep base images current (`postgres:16`, `python:3.11-slim`, `nginx:alpine`)
  and rebuild periodically — a pinned base image with no rebuilds accumulates
  unpatched CVEs.

## Verifying it

A checklist you can't execute decays into a checklist nobody runs. These are
the actual commands; run them before shipping and when auditing.

**Route coverage — every route's auth decorator:**

```bash
python3 - <<'PY'
import re
src = open('backend/app.py', encoding='utf-8').read().splitlines()
routes = []
for i, line in enumerate(src):
    m = re.match(r"@app\.route\('([^']+)'.*methods=\[([^\]]+)\]", line.strip())
    if m:
        j, decs = i + 1, []
        while j < len(src) and not src[j].lstrip().startswith('def '):
            if src[j].lstrip().startswith('@'): decs.append(src[j].strip())
            j += 1
        routes.append((m.group(1), decs, i + 1))
unprot = [r for r in routes if not any('token_required' in d for d in r[1])]
print(f"routes: {len(routes)}  unprotected: {len(unprot)}")
for path, _, ln in unprot: print(f"  app.py:{ln} {path}")
PY
```

Every line it prints must be one you can justify — the health check and
reviewed `/api/public/*` routes, nothing else.

**SQL interpolation — what actually gets interpolated:**

```bash
python3 - <<'PY'
import re
src = open('backend/app.py', encoding='utf-8').read()
for m in re.finditer(r"cur\.execute\(f'''(.{0,400}?)'''", src, re.S):
    ph = re.findall(r'\{([^}]+)\}', m.group(1))
    if ph: print(f"  line {src[:m.start()].count(chr(10))+1}: {set(ph)}")
PY
```

Every name it reports must be a structural fragment you built from hardcoded
strings (`where_sql`, `having_sql`), never a request value.

**Secrets never committed:**

```bash
git log --all --diff-filter=A --name-only --pretty=format: | sort -u \
  | grep -E "^\.env$|env\.sh$|\.env\."
git grep -nIE "(password|secret|api[_-]?key|token)\s*=\s*['\"][^'\"]{8,}" \
  -- ':!*.md' ':!package-lock.json'
```

Both must come back empty (modulo obvious placeholders).

**Compose variables vs template — catches silently-empty config:**

```bash
comm -23 <(grep -oE '[$][{][A-Z_]+' docker-compose.yml | tr -d '${' | sort -u) \
         <(grep -oE '^[A-Z_]+' env_sample | sort -u)
```

Anything listed is referenced by compose but missing from the template. If it
has no `:-default`, it resolves to an empty string and produces a silently
broken build.

**Frontend escape hatches:**

```bash
grep -rn "dangerouslySetInnerHTML\|eval(\|innerHTML" frontend/src/
```

**Exposed ports, from outside the host:**

```bash
nmap -Pn -p <db-port>,<backend-port> your-host
```

## Review checklist

Run this before shipping, and when auditing an existing app:

- [ ] Every route has an auth decorator except health and reviewed `/api/public/*`
- [ ] The backend verifies token signature, issuer, audience, expiry, scope
- [ ] Identity comes only from verified claims — no identity header anywhere
- [ ] No client secret on the SPA app registration
- [ ] Entra assignment (or app roles) actually restricts who can sign in
- [ ] All SQL values parameterised; no user input in an f-string
- [ ] Paging inputs clamped
- [ ] `.env` / `env.sh` / `frontend/.env` gitignored; no secrets in git history
- [ ] `frontend/.dockerignore` excludes `.env`
- [ ] No secret in any `VITE_`-prefixed variable
- [ ] Secure defaults for every `:-` fallback in compose
- [ ] Compose references no variable the template omits
- [ ] App refuses to start if auth is expected but unconfigured
- [ ] Dev bypass off, server-gated, and documented as local-only
- [ ] Public endpoints reviewed column-by-column, including joins
- [ ] No PII stored that the feature doesn't require
- [ ] No tokens or secrets in logs
- [ ] Errors return a generic message; detail goes to logs only
- [ ] No `dangerouslySetInnerHTML` / `eval` / `innerHTML` in the frontend
- [ ] Debug mode structurally impossible under Gunicorn
- [ ] Backend port not published; database port loopback-bound or unpublished
- [ ] Port exposure verified from outside the host, not from on it
- [ ] `Werkzeug` and `cryptography` pinned and current
- [ ] Backups exist, are offsite, and a restore has actually been tested
- [ ] Documentation doesn't describe or teach a superseded insecure pattern

That last one is easy to skip and matters: a runbook or blueprint that still
shows the old auth pattern will reproduce it in the next app.

## Review checklist

Run this before shipping, and when auditing an existing app:

- [ ] Every route has an auth decorator except health and reviewed `/api/public/*`
- [ ] The backend verifies token signature, issuer, audience, expiry, scope
- [ ] Identity comes only from verified claims — no identity header anywhere
- [ ] No client secret on the SPA app registration
- [ ] Entra assignment (or app roles) actually restricts who can sign in
- [ ] All SQL values parameterised; no user input in an f-string
- [ ] Paging inputs clamped
- [ ] `.env` / `env.sh` / `frontend/.env` gitignored; no secrets in git history
- [ ] `frontend/.dockerignore` excludes `.env`
- [ ] No secret in any `VITE_`-prefixed variable
- [ ] Secure defaults for every `:-` fallback in compose
- [ ] App refuses to start if auth is expected but unconfigured
- [ ] Dev bypass off, server-gated, and documented as local-only
- [ ] Public endpoints reviewed column-by-column, including joins
- [ ] No PII stored that the feature doesn't require
- [ ] No tokens or secrets in logs
- [ ] Database port not exposed publicly
- [ ] Backups exist, are offsite, and a restore has actually been tested
- [ ] Documentation doesn't describe or teach a superseded insecure pattern

That last one is easy to skip and matters: a runbook or blueprint that still
shows the old auth pattern will reproduce it in the next app.
