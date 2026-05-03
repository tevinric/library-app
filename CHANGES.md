# Browse Library Feature — Changes

## Files Changed

### 1. `backend/app.py`
**Added:** `/api/public/books` GET endpoint (no `@token_required` decorator).
- Returns only safe fields: `title`, `author`, `isbn`, `publication_year`, `publisher`, `cover_medium`
- Exposes **no** copy counts, checkout status, user IDs, or barcodes
- Uses `DISTINCT ON (LOWER(title), author)` to deduplicate across admin accounts
- Supports `?search=` query param filtered on title, author, or ISBN
- Results always sorted alphabetically by title

### 2. `frontend/src/api.js`
**Added:** `getPublicBooks(search)` — uses plain `axios` (not the authenticated `api` instance) so no `X-User-Email` header is sent and the 401 interceptor (which clears auth and reloads) is never triggered.

### 3. `frontend/src/pages/BrowseBooks.jsx` *(new file)*
Standalone visitor page with:
- Sticky header with ZOE Library branding and a "Back to Login" link
- Search bar with 300ms debounce, filtered alphabetically
- Responsive book grid (1 → 2 → 3 → 4 columns)
- Each card shows: cover image (lazy-loaded), title, author, publisher, year, ISBN
- Empty state, loading spinner, and error/retry UI
- **No sidebar, no links to any authenticated route, no admin functionality**
- Footer with a "Sign in" link back to the login page

### 4. `frontend/src/App.jsx`
Three targeted changes:
1. **Import** `BrowseBooks` and existing `BookIcon`
2. **Early return** — before the loading/auth checks, if `location.pathname === '/browse'` the component returns `<BrowseBooks />` immediately. This means the page is always accessible regardless of auth state, MSAL loading, or DEV mode.
3. **Login screen** — added a "Browse Library" `<Link to="/browse">` button below a divider on the login screen, styled distinctly from the Microsoft sign-in button.

## Security Measures
- The public backend endpoint is a **separate route** (`/api/public/books`) with no auth decorator — it cannot be used to access any admin data.
- The public endpoint returns only display-safe fields; no UUIDs, barcodes, copy counts, or checkout data are exposed.
- `BrowseBooks` uses plain `axios` with no auth headers — it cannot reach any `@token_required` endpoint even if someone inspects the network.
- The `BrowseBooks` component contains no navigation, state, or references that could lead a visitor to any authenticated route.
- The early return in `App.jsx` means authenticated users who visit `/browse` see the same public page — there is no path from `/browse` into the admin app.
