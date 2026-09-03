---
name: secure-entra-app-auth
description: Use when building, deploying, or reviewing an app that authenticates users via Microsoft Entra ID (Azure AD) with a SPA/public-client frontend and a separate backend API. Covers app registration, MSAL setup, exposing an API scope, server-side token verification (JWKS, iss/aud/exp/scp), authorization without groups, build-time vs runtime config in containerized frontends, and a troubleshooting table for the common failure modes (Invalid issuer, Invalid audience, stuck in dev mode, AADSTS errors).
---

# Secure Entra ID app auth (SPA + backend API)

This skill exists because of one recurring bug class: a frontend authenticates
against Entra ID, then tells the backend who the user is via some value the
frontend itself controls (a header, a body field, a cookie it set) — and the
backend just believes it. That's not authentication, it's a self-reported
name tag. The fix is always the same shape: **the backend must cryptographically
verify a token issued by Entra on every request, and derive identity only from
claims inside that verified token — never from anything the client asserts
out-of-band.**

Read this fully before writing auth code for a new app, or when reviewing one.

## The mental model

```
Browser (MSAL)  --sign in-->  Entra ID  --signed JWT-->  Browser
Browser  --Authorization: Bearer <JWT>-->  Backend
Backend  --verify signature via Entra's public keys (JWKS)-->  trust established
Backend  --read oid/preferred_username claims from the VERIFIED token-->  identity
```

If your backend's auth check reads anything other than a token it independently
verified — a header, a query param, a "trust me" flag, a decoded-but-unverified
JWT payload — it is not enforcing authentication. It's decoration.

## Part 1 — Entra app registration

- **Platform type: SPA**, not "Web". A SPA is a public client — it cannot keep
  a secret confidential in the browser, so it doesn't get one. If you ever see
  a client secret configured for a browser-based app, that's a finding: delete
  it and confirm the platform type is SPA.
- **Expose an API** (App registrations → this app → Expose an API):
  - Accept the default Application ID URI (`api://<client-id>`) or set your own.
  - Add a scope, e.g. `access_as_user`. Who can consent: Admins and users is
    fine for an internal tool. State: Enabled.
  - Under "Authorized client applications", add this same app's client ID
    against the new scope — otherwise users get an extra consent prompt for
    a scope your own app already owns.
- **Set the token version to 2** (App registrations → Manifest):
  `"requestedAccessTokenVersion": 2` in the Microsoft Graph app manifest, or
  `"accessTokenAcceptedVersion": 2` in the older AAD Graph manifest format.
  A registration where you added an "Expose an API" scope without touching
  this field issues **v1** tokens, even though MSAL.js signs in against the
  v2 endpoint. See the issuer notes in Part 3 — this is a very common
  first-deploy failure.
- **Redirect URI**: your actual deployed origin(s) plus `http://localhost:<dev-port>`
  for local dev. Platform SPA, not Web — SPA redirect URIs use the
  authorization-code-with-PKCE flow MSAL.js expects. The value the frontend
  is built with must match one registered here exactly, scheme and all.
- **Authorization model without App Roles or Security Groups**: go to
  **Enterprise Applications → this app → Properties → "Assignment required?"
  = Yes**, then **Users and groups → Add user/group** for exactly the people
  allowed in. With this set, Entra refuses to issue a token to anyone not
  assigned — sign-in fails with `AADSTS50105` before your app ever sees them.
  This means: if a request reaches your backend with a token that verifies
  (signature, issuer, audience, not expired), Entra has already confirmed that
  person is on the allowed list. Your backend does not need a second
  allow-list check in this setup — don't add one, it's redundant surface area
  that can drift out of sync with the real source of truth in Entra.
  - If you outgrow this (need different permission tiers, not just
    in-or-out), move to **App Roles** (defined on the app registration,
    assigned per-user in Enterprise Applications, appear in the token's
    `roles` claim) before reaching for security groups — groups require a
    `GroupMembershipClaims` manifest change and can hit a claims-overage limit
    for users in many groups; roles don't.

## Part 2 — Frontend (MSAL)

- `PublicClientApplication` config needs `clientId`, `authority`
  (`https://login.microsoftonline.com/<tenant-id>`), `redirectUri`. No secret,
  ever — anything under `VITE_`/`NEXT_PUBLIC_`/similar is shipped to every
  visitor's browser and is not a place for confidential values.
- **`loginRequest.scopes` must target your OWN API's scope**, not a Microsoft
  Graph scope like `User.Read`. This is the single most common setup mistake:
  a Graph-scoped token has `aud` = Graph's app ID, and your backend can never
  validate that as its own audience no matter how correct the verification
  code is. Request `api://<client-id>/access_as_user` (whatever scope name you
  exposed in Part 1) if the token needs to reach your own backend.
- After acquiring a token (`acquireTokenSilent`, falling back to
  `acquireTokenPopup`/`acquireTokenRedirect`), send it as
  `Authorization: Bearer <token>` on every API call. Do not also send the
  user's email/id as a separate header "for convenience" — the backend gets
  identity from the token, full stop. A second, unverified channel for the
  same information is exactly the bug this skill exists to prevent.
- A client-side "is this user authorized" check (e.g. gating UI on login
  success) is a UX nicety, never a security boundary — the backend enforces
  access regardless of what the frontend shows or hides.
- Access tokens expire (~1h). Decide deliberately how expiry is handled: a
  401 interceptor that triggers a fresh `acquireTokenSilent` is fine; one that
  clears storage and hard-reloads is cruder but acceptable. What's not
  acceptable is caching a token indefinitely and being surprised by 401s.

## Part 3 — Backend (token verification)

On every protected route, verify — don't decode-and-trust:

1. **Signature** — fetch Entra's public signing keys from the tenant's JWKS
   endpoint (`https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys`),
   cache them, and verify the token was signed with a key that appears there.
   Use a maintained JWT library with JWKS support — don't hand-roll signature
   verification:
   - Python: `PyJWT` + `jwt.PyJWKClient(jwks_uri)`
   - Node: `jsonwebtoken` + `jwks-rsa`
   - .NET: `Microsoft.Identity.Web` (handles this whole section for you)

   The v2 JWKS endpoint serves the keys for v1-format tokens too, so you don't
   need a second key source if you accept both (see below).
2. **Issuer** (`iss`) — must be an Entra issuer **for your tenant's GUID**.
   Entra emits one of two formats depending on the manifest's
   `requestedAccessTokenVersion`:
   - v2 tokens: `https://login.microsoftonline.com/<tenant-id>/v2.0`
   - v1 tokens: `https://sts.windows.net/<tenant-id>/` (note trailing slash)

   **Prefer v2** (set the manifest as in Part 1) — it's the current identity
   platform, and newer capabilities are built around it. But **accept both
   formats** in validation code anyway. Both pin your tenant's GUID, so
   accepting either is not a weakening: an attacker would still need a token
   Entra signed, for your tenant, with your audience and scope. Pinning only
   v2 buys nothing and turns a manifest change into a total outage.

   Library caveat: PyJWT's `jwt.decode(issuer=...)` takes a single string
   until 2.10 — to accept two, omit the parameter and compare `claims['iss']`
   against a set yourself, unconditionally, after decoding.
3. **Audience** (`aud`) — must identify your API. The form varies with token
   version: v1 typically carries the App ID URI (`api://<client-id>`), v2
   typically the bare client-ID GUID. Accept both, so switching token versions
   doesn't break you.
4. **Expiry** (`exp`) — your JWT library checks this automatically as long as
   you don't disable it; don't disable it.
5. **Scope** (`scp`) — confirm the expected scope name (e.g. `access_as_user`)
   is present, so a token minted for a different purpose that happens to share
   your audience can't slip through. Present in both v1 and v2 delegated tokens.
6. **Identity claims** — see the identity section below; this is where most
   designs quietly go wrong.
7. **Fail closed** — any verification failure is a 401, with a generic
   message. Don't leak whether it failed on signature vs. issuer vs. expiry;
   that's diagnostic detail for your logs, not the caller.

   Do put it in the logs, though. On an `iss`/`aud` mismatch specifically,
   log the values the token actually carried next to the ones you expected.
   The signature has already been verified by that point, and `iss`/`aud` are
   endpoint identifiers rather than secrets, so it's safe to log — and it
   turns "Invalid issuer" from a guessing game into a one-line diagnosis.
   Never log the raw token itself; it's a live credential until it expires.

### Which claim is the user's identity

- **`oid`** (object ID) is the stable, unique-per-user-per-tenant identifier.
  Pair it with **`tid`** if the app can ever see more than one tenant. This is
  what user records should be keyed on.
- **`preferred_username`** (v2), **`upn`**/**`unique_name`** (v1), and `email`
  are human-readable but **mutable** — Microsoft documents them as unsuitable
  for authorization decisions. A UPN changes on a name change or domain
  migration, and can in principle be reassigned. Store them as display data.
- Practical hazard when switching token versions: if you key user rows on the
  email-ish claim, a user whose `upn` and `preferred_username` differ can get
  a **second, duplicate user row** after the switch. Key on `oid` and this
  can't happen. If you inherit a schema keyed on email, add an `oid` column,
  backfill it on next login, then move the lookup over.
- Read identity with a fallback chain (`preferred_username` → `upn` → `email`)
  only for the display value, never as the primary key.

### Local dev without hitting Entra

It's fine to have a bypass for local development, but it must be gated by a
flag **the backend's own environment sets**, never by anything a request can
influence:

```python
AUTH_DEV_BYPASS = os.getenv('APP_AUTH_DEV_BYPASS', 'false').lower() == 'true'
```

- Default `false`. Document loudly that it must never be `true` anywhere
  reachable outside your own machine.
- Fail loud, not silent, if real auth is expected but unconfigured — e.g.
  raise on startup if `AUTH_DEV_BYPASS` is false and the tenant/client ID
  env vars are missing, rather than limping into a broken or accidentally-open
  state.
- Keep the bypass's trusted signal (e.g. a dev header) syntactically distinct
  from anything used in the real path, so the two can't be confused during
  review.
- The frontend's dev-mode flag and the backend's bypass flag are **two
  independent switches**. A frontend built in dev mode talking to a backend
  with the bypass off produces blanket 401s — which is the correct, safe
  failure, but confusing if you don't expect it.

## Part 4 — Build-time config (where containerized SPAs go wrong)

Bundlers (Vite, CRA, Next's `NEXT_PUBLIC_*`) **inline env values into the
static JS at build time**. For a containerized frontend this has a consequence
people repeatedly get wrong:

> Runtime environment variables — `docker-compose.yml` `environment:`, Kubernetes
> env, an `.env` mounted into the running container — have **zero effect** on a
> built SPA. By the time the container starts, the values are already baked
> into the bundle being served.

So:

- Pass frontend config as **Docker build args**, consumed by `ARG` + `ENV` in
  the build stage *before* the build command:

  ```dockerfile
  ARG VITE_APP_ENV_TYPE=PROD          # default to the SECURE value
  ARG VITE_APP_AZURE_CLIENT_ID
  ENV VITE_APP_ENV_TYPE=$VITE_APP_ENV_TYPE \
      VITE_APP_AZURE_CLIENT_ID=$VITE_APP_AZURE_CLIENT_ID
  RUN npm run build
  ```

  ```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_APP_ENV_TYPE: ${APP_FRONTEND_ENV_TYPE:-PROD}
        VITE_APP_AZURE_CLIENT_ID: ${APP_AZURE_CLIENT_ID}
  ```

- **Default the mode ARG to the secure value**, so a build that forgets to
  pass it ships real auth rather than silently shipping a dev bypass.
- **`.dockerignore` the local `.env`** (and `.env.*`). A `COPY . .` otherwise
  drags your dev config — often with a dev-mode flag and localhost redirect
  URIs — into the production image, where the bundler happily picks it up.
  This is the actual mechanism behind "I redeployed and it's still stuck in
  dev mode".
- Rebuilding matters: `docker-compose up -d` reuses the existing image.
  Frontend config changes need `up --build`.
- Keep one source of truth. A repo-root `.env` feeding compose (which feeds
  build args) beats a second per-frontend `.env` that only some code paths
  read.
- Redirect URIs get baked in the same way — building with `http://localhost`
  and deploying to a real domain produces `AADSTS50011` at sign-in.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid issuer`, signature otherwise fine | App registration issues v1 tokens (`sts.windows.net`) but code pins v2 | Accept both issuer forms; set `requestedAccessTokenVersion: 2` |
| `Invalid audience` | Frontend requested a Graph scope (`User.Read`), so `aud` is Graph | Request `api://<client-id>/<scope>` instead |
| `Invalid audience`, `aud` looks like your app | v1/v2 `aud` form mismatch (`api://GUID` vs bare `GUID`) | Accept both forms |
| 401 with no `Authorization` header present | Frontend built in dev mode, sending a dev header instead of a token | Rebuild frontend with the correct build args |
| Redeploy doesn't change frontend behaviour | Runtime env vars don't affect a built SPA; or image not rebuilt | Build args + `up --build` |
| `AADSTS50105` | User isn't assigned to the app, and assignment is required | Assign them in Enterprise Applications → Users and groups |
| `AADSTS50011` | Redirect URI built into the bundle isn't registered | Register the exact deployed origin as an SPA redirect URI |
| Duplicate user rows after a config change | Records keyed on a mutable email-ish claim | Key on `oid` |

When a token is rejected and the reason isn't obvious, log the token's actual
`iss`/`aud` against the expected values (never the token itself) — that single
line resolves most of this table immediately.

## Checklist for a new app

- [ ] App registration platform = SPA, no client secret present
- [ ] Expose an API → scope added → this app authorized as a client of its own scope
- [ ] Manifest `requestedAccessTokenVersion: 2`
- [ ] Enterprise Application → Assignment required = Yes → specific users assigned
      (or App Roles if you need tiers, not just in/out)
- [ ] Redirect URIs registered for every deployed origin, not just localhost
- [ ] Frontend requests `api://<client-id>/<scope>`, not a Graph scope
- [ ] Frontend sends `Authorization: Bearer <token>` — no parallel identity header
- [ ] Backend verifies signature via JWKS, checks iss/aud/exp/scp
- [ ] Backend accepts both issuer forms and both audience forms
- [ ] Backend keys user identity on `oid`, not on a mutable email claim
- [ ] Backend authorization decision matches how you actually gated access in
      Entra (assignment-only vs. role claim vs. group claim) — don't build a
      check for a claim type you didn't configure
- [ ] Dev bypass, if any, is gated by a server-only env flag, defaults off,
      and the app refuses to start in a real-auth-expected state if
      misconfigured
- [ ] Frontend config passed as build args; local `.env` in `.dockerignore`;
      mode ARG defaults to the secure value
- [ ] `.env` files and any build output are gitignored; no secrets in
      history; a public/anonymous endpoint's query is checked column-by-column
      for anything that shouldn't be exposed pre-login

## Related skills

This skill covers authentication specifically. `security-baseline` covers the
surrounding posture (SQL, secrets, PII, public endpoints, fail-closed
defaults) and carries the pre-ship review checklist. `app-architecture` is the
entry point for building a new app in this house style, and names the build
order that puts auth in at step 5 rather than bolting it on at the end.

## Reference implementation

`library-app` is a worked example of this whole pattern, including the
before/after of the header-trust vulnerability:

- `backend/app.py` — `token_required()`, `_verify_entra_token()`: PyJWKClient
  signature verification, dual issuer/audience acceptance, scope check,
  claim-based identity, server-gated dev bypass, iss/aud mismatch diagnostics
- `frontend/src/authConfig.js` — custom API scope instead of a Graph scope
- `frontend/src/api.js` — bearer token in PROD, dev header only in dev mode
- `frontend/Dockerfile`, `frontend/.dockerignore`, `docker-compose.yml` —
  build-arg configuration and dev-`.env` exclusion
