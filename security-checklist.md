# Security checklist — outstanding items

Findings from the audit on 2026-09-03, ordered by what to tackle first.
Everything here is **outstanding work** — the things already verified as
correct are recorded at the bottom so nobody re-litigates them.

Standards for new apps live in `.claude/skills/security-baseline/`, including
runnable versions of the audit commands.

---

## 1. Verify published container ports aren't internet-reachable

**Priority: do this first.** Everything else on this list is smaller than this
one if it turns out to be true.

`docker-compose.yml` publishes two ports on all interfaces:

- `5433:5432` — PostgreSQL
- `${ZOELIBRARYAPP_BACKEND_PORT:-5002}:5002` — the backend API

**Docker writes its own iptables rules ahead of UFW**, so `ufw deny` does not
reliably block a published container port. If the VPS has a public IP, the
database and the API may be directly reachable — bypassing the Cloudflare
tunnel entirely, along with anything in front of it.

**Check, from a machine that is not the VPS:**

```bash
nmap -Pn -p 5002,5433 <vps-ip-or-hostname>
```

Checking from on the host proves nothing — loopback always answers.

**Fix if open:**

- Remove the `ports:` block from the `backend` service entirely. It needs no
  host port; nginx reaches it over the compose network as
  `library_app_backend:5002`.
- Bind Postgres to loopback so only an SSH tunnel can reach it:
  ```yaml
  ports:
    - "127.0.0.1:5433:5432"
  ```
- Re-run the scan to confirm.

- [ ] Scanned from outside the host
- [ ] Backend port mapping removed
- [ ] Postgres bound to `127.0.0.1`
- [ ] Re-scanned and confirmed closed

---

## 2. Stop returning raw exception text to clients

37 endpoints in `backend/app.py` end with:

```python
return jsonify({'error': str(e)}), 500
```

This hands any authenticated user SQL fragments, column names, and internal
paths whenever something breaks. It's also inconsistent with the auth code,
which already does the right thing: log the detail, return a generic message.

**Fix pattern:**

```python
except Exception as e:
    logger.error(f"Error doing X: {str(e)}")
    return jsonify({'error': 'Could not complete the request'}), 500
```

Find them all:

```bash
grep -n "jsonify({'error': str(e)}), 500" backend/app.py
```

- [ ] All 37 replaced with generic messages
- [ ] `logger.error` retains the detail in every case

---

## 3. Update security-relevant dependencies

`backend/requirements.txt`:

- **`cryptography==41.0.7`** — dates from late 2023, and it is the library that
  verifies Entra token signatures. Highest-value upgrade in the tree.
- **`Werkzeug` is not pinned at all** — it arrives transitively via Flask, so
  the version in the image depends on when it was last built. Pin it.
- Others (`Flask==3.0.0`, `PyJWT==2.8.0`, `requests==2.31.0`) are pinned but
  worth a review pass.

Note: `PyJWT` 2.10+ allows a list for `jwt.decode(issuer=...)`. If PyJWT is
upgraded, the manual issuer check in `_verify_entra_token()` can be simplified
back into `jwt.decode` — see the comment there.

- [ ] `cryptography` updated
- [ ] `Werkzeug` pinned explicitly
- [ ] Remaining pins reviewed
- [ ] Rebuilt and sign-in re-tested end to end
- [ ] Recurring reminder set to rebuild base images

---

## 4. Documentation still teaches the vulnerability

The header-trust auth model was removed from the code but is still documented
as the design. **`skills.md` is the one that matters** — it's the app-building
blueprint, so it would reproduce this bug in the next app built from it.

**Describes header auth as the design:**
- `skills.md:402, 443-446, 779` — the old `token_required()` and axios
  interceptor as copy-paste template code
- `README.md:286` — offers email-header auth as a supported alternative
- `readmes/ENV_SETUP.md:160` — "The backend always accepts the `X-User-Email`
  header for authentication"

**Broken examples (these now return 401):**
- `readmes/QUICKSTART.md:192, 195, 198`
- `guides/04-LINUX-SSL-NGINX-SETUP.md:935`

**Dead variable `AZURE_REQUIRED_GROUP_ID`:**
- `guides/01-VPS-DEPLOYMENT.md:153`
- `guides/04-LINUX-SSL-NGINX-SETUP.md:319`
- `readmes/DEPLOYMENT_SUMMARY.md:248`
- `readmes/ENV_SETUP.md:34, 94, 119, 207`
- `skills.md:113`

**Undocumented:** no guide covers the build-args deployment flow, so
`guides/01-VPS-DEPLOYMENT.md` walks through editing `.env` without mentioning
that frontend changes need `up --build`.

Leave alone: `CHANGES.md:14` is a historical changelog entry and accurately
describes a past change.

- [ ] `skills.md` auth template replaced (or file retired in favour of `.claude/skills/`)
- [ ] `README.md` / `ENV_SETUP.md` auth descriptions corrected
- [ ] curl examples updated to use a bearer token
- [ ] `AZURE_REQUIRED_GROUP_ID` references removed
- [ ] Build-args flow documented in the deployment guide

---

## 5. Env templates out of sync with compose

`env_sample` and `env_sample.sh` are missing variables `docker-compose.yml`
references. Two are harmless (`AUTH_DEV_BYPASS` and `FRONTEND_ENV_TYPE` have
`:-false` / `:-PROD` defaults), but these two have **no default**:

- `ZOELIBRARYAPP_AZURE_REDIRECT_URI`
- `ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI`

A fresh `.env` copied from the current template builds the frontend with an
empty redirect URI, which silently falls back to `http://localhost:3002` and
fails sign-in on the real domain with `AADSTS50011`.

`env_sample` also still lists `ZOELIBRARYAPP_AZURE_REQUIRED_GROUP_ID`, which
nothing reads.

```bash
comm -23 <(grep -oE '[$][{][A-Z_]+' docker-compose.yml | tr -d '${' | sort -u) \
         <(grep -oE '^[A-Z_]+' env_sample | sort -u)
```

- [ ] Both redirect URI variables added to `env_sample` and `env_sample.sh`
- [ ] `AZURE_REQUIRED_GROUP_ID` removed
- [ ] `comm` check returns only variables that have safe defaults

---

## 6. Lower priority — accept knowingly or fix later

**Access token in `localStorage`** (`frontend/src/api.js`, `App.jsx`)
Exfiltratable by XSS in principle. Currently low risk — no XSS vectors exist
and React escapes by default. Moving to in-memory storage with MSAL silent
renewal is the stronger pattern but adds complexity. Reasonable to accept
deliberately; revisit if the app ever renders user-supplied HTML.
- [ ] Decision recorded either way

**No rate limiting**
`/api/public/*` is unauthenticated, uncapped, and deliberately excluded from
`activity_log` — so abuse would be both unlimited and invisible. Cloudflare
absorbs some of this. Consider Flask-Limiter, or a Cloudflare rate-limiting
rule, if the catalogue is ever heavily scraped.
- [ ] Decision recorded either way

**`SECRET_KEY` falls back to `'dev-secret-key'`** (`backend/app.py:27`)
Currently inert — the app is stateless and uses no Flask sessions. Becomes a
real problem the moment sessions or flash messages are added. Make it fail
loudly instead of defaulting.
- [ ] Fallback removed, startup fails when unset

**CORS still allows `X-User-Email`** (`backend/app.py:45`)
Grants nothing — nothing reads that header in production — but it
misrepresents the current model to anyone reading the config.
- [ ] Removed from `allow_headers`

---

## 7. Operational settings to confirm (outside the repo)

These carry more weight than most of the code items and can't be checked from
the source tree.

- [ ] `ZOELIBRARYAPP_AUTH_DEV_BYPASS` is absent or `false` in the deployed `.env`
- [ ] Deployed frontend was built with `ENV_TYPE=PROD` — landing page shows
      Microsoft sign-in, no "DEV MODE" badge in the sidebar
- [ ] Entra → Enterprise Applications → this app → Properties →
      **"Assignment required?" = Yes**
- [ ] Users and groups lists only the people who should have access
- [ ] A restore from backup has actually been performed and timed

That third item is the entire authorisation model right now. If it's ever
switched off, any account in the tenant can sign in.

---

## Verified correct — do not re-litigate

Confirmed against the code on 2026-09-03:

- **Route coverage**: 42 routes, 38 with `@token_required`. The 4 without are
  `/api/health` and the 3 reviewed `/api/public/*` endpoints.
- **Token verification**: JWKS signature, audience (both forms), issuer (both
  v1 and v2 forms, tenant-pinned), expiry, and `scp` scope. Identity is read
  only from verified claims.
- **No SQL injection**: every user value is parameterised; only structural
  fragments built from hardcoded strings are interpolated. Paging clamped.
- **Public endpoints**: named columns only, no user or borrower joins, no PII.
- **Secrets**: no `.env`/`env.sh` in git history, `.gitignore` and
  `frontend/.dockerignore` correct, no credentials in tracked files.
- **No XSS vectors**: no `dangerouslySetInnerHTML`, `eval`, or `innerHTML`.
- **Debug mode**: only inside `if __name__ == '__main__'`, which Gunicorn
  never executes — structurally impossible in production.
- **PII minimisation**: borrowers carry a random 8-character ID and no name,
  email, or contact detail.
