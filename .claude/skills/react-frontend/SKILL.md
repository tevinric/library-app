---
name: react-frontend
description: Use when building or extending the React/Vite frontend for an app in this house style — adding pages, wiring API calls, building modals and lists, or working with the Tailwind design system. Covers the api.js pattern, the page component template, the shared component classes, date formatting, the auth gate, and the build-time environment variable trap.
---

# React frontend conventions

React 18 + Vite 5 + Tailwind + react-router-dom + axios + MSAL + date-fns.
Built to a static bundle and served by nginx — there is no Node process in
production.

## api.js — every endpoint in one file

One axios instance carrying auth, plus one named export per endpoint. Pages
import functions; pages never construct URLs or touch axios directly.

```js
const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_{APPNAME}_API_URL || 'http://localhost:5002'),
})
```

`import.meta.env.PROD ? ''` is load-bearing: in production nginx proxies
`/api` from the same origin, so a relative base URL is correct and no CORS is
involved. Only dev talks cross-origin to the backend port.

Auth header, and the one exception to it:

```js
const isDevMode = import.meta.env.VITE_{APPNAME}_ENV_TYPE === 'DEV'

api.interceptors.request.use((config) => {
  if (isDevMode) {
    const userEmail = localStorage.getItem('userEmail')
    if (userEmail) config.headers['X-User-Email'] = userEmail
  } else {
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken) config.headers['Authorization'] = `Bearer ${accessToken}`
  }
  return config
})
```

The dev branch only works if the backend's own `{APPNAME}_AUTH_DEV_BYPASS` is
also true — two independent switches, one on each side. **Never send an
identity header alongside the bearer token in production**; a second,
unverified channel for identity is exactly the vulnerability class this
architecture exists to avoid.

Response interceptor sends expired sessions back to sign-in:

```js
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
```

Endpoint exports are one line each, grouped by entity with banner comments:

```js
export const get{Entities} = (search = '') => api.get('/api/{entities}', { params: { search } })
export const get{Entity}   = (id) => api.get(`/api/{entities}/${id}`)
export const create{Entity} = (data) => api.post('/api/{entities}', data)
export const update{Entity} = (id, data) => api.put(`/api/{entities}/${id}`, data)
export const delete{Entity} = (id) => api.delete(`/api/{entities}/${id}`)
```

**Public endpoints use bare `axios`, not the `api` instance** — otherwise the
401 interceptor fires for anonymous visitors and boots them into a reload loop:

```js
export const getPublic{Entities} = (params) => axios.get(`${publicBaseURL}/api/public/{entities}`, { params })
```

## Page component template

One file per route in `src/pages/`. Every page follows this shape:

```jsx
function {Entity}Page() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [search])

  const load = async () => {
    try {
      setLoading(true)
      const response = await get{Entities}(search)
      setItems(response.data)
    } catch (error) {
      console.error('Error loading {entities}:', error)
    } finally {
      setLoading(false)
    }
  }

  // spinner only on first load — not on every refetch
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* header: h1 + subtitle, action button right */}
      {/* search card */}
      {/* empty state OR list */}
      {/* modals last */}
    </div>
  )
}
```

- **Ordering comes from the backend.** Don't re-sort client-side; the API
  already returns newest-first.
- **Always handle the empty state explicitly** — a card saying "No {entities}
  found", never a blank page.
- **Show the count** above lists, pluralised.
- **Errors from mutations** surface via `error.response?.data?.error || error.message`
  so the backend's message wins when it has one.

## The design system

Component classes live in `src/App.css` — use them instead of re-deriving
Tailwind stacks per page:

```
.card  .btn-primary  .btn-secondary  .btn-success  .btn-danger
.badge .badge-primary .badge-success .badge-warning .badge-danger .badge-neutral
.alert-success .alert-warning .alert-danger
.modal-overlay .modal-content  .icon-circle  .stat-card .stat-icon .stat-number
.sidebar-link .list-row .gradient-text
```

Palette (in `tailwind.config.js`): `ink` for text, `primary` for brand, and
`success` / `warning` / `danger` as semantic states, each with 50–900 shades.
Semantic colours mean state, never decoration — don't use `danger` for a
non-destructive accent.

If a new pattern is needed more than twice, add a class to `App.css` rather
than repeating utility strings.

## Modals

Overlay closes on backdrop click; content stops propagation:

```jsx
{showModal && (
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      ...
    </div>
  </div>
)}
```

When an action generates a value the user must keep — a generated ID, a
one-time code — show it in a success modal with a copy button, and say plainly
that it won't be shown again. Guard the clipboard call: `navigator.clipboard`
only exists in a secure context (HTTPS or localhost), so catch the failure and
fall back to asking the user to select the text, which should carry
`select-all`.

## Dates

`date-fns`, imported directly. House formats:

```js
import { format, formatDistanceToNow } from 'date-fns'

format(new Date(row.created_at), 'MMM d, yyyy h:mm a')   // timestamps
format(new Date(row.due_date), 'MMM d, yyyy')            // dates
formatDistanceToNow(new Date(row.checkout_date), { addSuffix: true })  // relative
```

Guard values that may be absent or malformed before formatting — `date-fns`
throws on an invalid date and takes the whole page down:

```js
const d = new Date(value)
return isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy h:mm a')
```

## Auth gate

`main.jsx` creates the `PublicClientApplication`, calls `initialize()`, sets
the active account, and only then renders inside `<MsalProvider>`. `App.jsx`
owns the gate and renders one of: loading spinner, public landing page,
"Access Denied", or the authenticated shell.

Sign-in failures must surface on the page — never `.catch(console.error)`,
which leaves the user staring at an unchanged screen. Show a generic message;
never render the raw MSAL/AADSTS text, which names your tenant and app
registration. See `secure-entra-app-auth`.

Client-side gating is UX only. The backend enforces access on every request
regardless of what the UI shows or hides.

## Environment variables are baked at build time

**This is the single most common deployment mistake with this stack.** Vite
inlines `VITE_*` values into the JS bundle during `npm run build`. Runtime
environment — docker-compose `environment:`, an `.env` mounted into the running
container — has **no effect** on an already-built bundle.

Therefore:

- Frontend config is passed as **Docker build args**, consumed by `ARG`/`ENV`
  in the build stage before `npm run build`. See `docker-compose-stack`.
- `frontend/.dockerignore` must exclude `.env` and `.env.*`, or `COPY . .`
  drags your local dev config — dev-mode flag, localhost redirect URIs —
  into the production image, where Vite happily bakes it in.
- The mode arg defaults to the **secure** value (`PROD`), so a build that
  forgets to pass it ships real auth rather than a bypass.
- Frontend changes require `docker-compose up --build`; a plain `up` reuses
  the old image and appears to do nothing.
- Anything `VITE_`-prefixed is shipped to every visitor. Never put a secret there.

## nginx

```nginx
location / {
    try_files $uri $uri/ /index.html;    # SPA routing
}
location /api {
    proxy_pass http://{app}_backend:{BACKEND_PORT};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`try_files ... /index.html` is what makes client-side routes survive a refresh.
The `X-Forwarded-For` header is what the backend's activity log records as the
client IP.

## Frontend Dockerfile

Two stages — Node builds, nginx serves:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_{APPNAME}_ENV_TYPE=PROD
# ... remaining ARGs, promoted to ENV, before the build
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

The runtime image contains no Node, no source, and no `node_modules`.
