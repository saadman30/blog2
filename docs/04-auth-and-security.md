# 04 — Auth & security

This page explains **who can call what**, and **how identity moves** between browser and API.

---

## The big idea (simple English)

1. You **register** or **login**.
2. The API gives you a short-lived **access token** (JWT string in the JSON body).
3. The API also sets an httpOnly **refresh cookie** named `refreshToken` (browser JS cannot read it).
4. For protected API calls, the web app sends:

   `Authorization: Bearer <accessToken>`

5. When the access token expires, `apiFetch` calls `POST /api/auth/refresh` once and retries the original request. The browser automatically sends the cookie (`credentials: 'include'`). The API returns a new access token (and rotates the refresh cookie).

6. **Logout** clears the refresh cookie.

---

## Token contents

JWT payload (`JwtPayload`):

```text
sub   → user id (uuid)
email → user email
role  → ADMIN | EDITOR
```

Two secrets:

- `JWT_ACCESS_SECRET` — access tokens
- `JWT_REFRESH_SECRET` — refresh tokens

Default lifetimes from env: access `15m`, refresh `7d`.

---

## Password handling

- Passwords hashed with **bcrypt**, cost factor **12**
- Never returned from API (`sanitizeUser` strips `password` and `twoFactorSecret`)

---

## Registration

`POST /api/auth/register` accepts `email` and `password` only. New accounts are always assigned **`EDITOR`**. Clients cannot self-assign `ADMIN` via the register body (`forbidNonWhitelisted` rejects unknown fields).

Promoting users to `ADMIN` requires a database update or a future admin-only endpoint — there is no seed script yet.

---

## Two-factor authentication (partial)

User entity has:

- `twoFactorEnabled`
- `twoFactorSecret`

On login, if 2FA is enabled, the client must send `twoFactorCode` that **exactly equals** `twoFactorSecret` (simple equality check — not a TOTP library).

`AuthService.enableTwoFactor(userId, secret)` exists in the service, but there is **no public controller endpoint** exposing it yet. Settings page on the web is copy-only.

---

## Global security pipeline

Configured in `main.ts` + `app.module.ts`.

### 1. Helmet

Sets common HTTP security headers on every response.

### 2. Cookie parser

Needed so Nest can read `req.cookies.refreshToken`.

### 3. CORS

```text
origin: CORS_ORIGIN (default http://localhost:4321)
credentials: true
methods: GET, POST, PATCH, PUT, DELETE, OPTIONS
headers: Content-Type, Authorization
```

`credentials: true` is required for the refresh cookie to be stored/sent cross-origin (web 4321 → api 3001).

### 4. ValidationPipe (global)

- `whitelist: true` — strip unknown properties
- `forbidNonWhitelisted: true` — reject requests with unknown properties
- `transform: true` — coerce types into DTO classes

### 5. ThrottlerGuard (global)

Default: **100 requests / 60 seconds** per client.

Auth overrides:

| Route | Limit |
|-------|-------|
| `POST /auth/register` | 5 / minute |
| `POST /auth/login` | 10 / minute |

### 6. JwtAuthGuard (global)

- Every route requires a valid JWT **unless** marked `@Public()`
- Public examples: health, published posts, auth endpoints, clap/view analytics

### 7. RolesGuard (global)

- If a route has `@Roles(...)`, the user’s role must be in that list
- If no `@Roles`, role check passes (auth still required unless `@Public`)

Role rules used today:

| Action | Roles |
|--------|-------|
| Create / update posts, admin list, upload media, analytics summary | `ADMIN` or `EDITOR` |
| Delete post, delete media | `ADMIN` only |

---

## Refresh cookie details

Set by `AuthController.setRefreshCookie`:

| Option | Value |
|--------|-------|
| Name | `refreshToken` |
| httpOnly | `true` |
| sameSite | `strict` |
| secure | `true` only when `NODE_ENV === 'production'` |
| path | `/api/auth` |
| maxAge | 7 days |

Because `path` is `/api/auth`, the cookie is only sent to auth routes — not to every `/api/posts` call. That is intentional: access token handles normal API auth; refresh is only for `/auth/refresh` and related auth paths.

Logout clears the same cookie options.

---

## How the web stores auth

File: `apps/web/src/stores/auth-store.ts` (nanostores)

| Piece | Where |
|-------|-------|
| Access token | In-memory atom + `sessionStorage['pcms-access-token']` |
| User `{ id, email, role }` | In-memory atom + `sessionStorage['pcms-user']` |

Helpers:

- `setAuth` — after login
- `clearAuth` — logout / bad session
- `hydrateAuth` — reload from sessionStorage
- `isAuthenticated`

**Session restore:** `AuthHydrate` (`components/backoffice/AuthHydrate.tsx`) runs on every `/app/*` page via `AppLayout.astro` (and on `/app` login home). After a full refresh, sessionStorage values are loaded back into the nanostore.

**Token refresh:** `apiFetch` (`utils/api-client.ts`) retries once on HTTP 401 by calling `POST /auth/refresh`, then updates the store if a user is present.

Back-office routes (`/app/*`) are **not server-guarded**. Anyone can open `/app/write`. The write form fails with “Authentication required” if there is no token.

---

## Public vs protected API map (quick)

**Public (`@Public`):**

- `POST /auth/register|login|refresh|logout`
- `GET /posts`, `GET /posts/:slug`
- `POST /analytics/:postId/view|clap`, `GET /analytics/:postId`
- `GET /health`, `GET /health/live`

**Needs JWT + role:**

- Everything under admin posts, media upload/list, analytics summary, etc.

Full route table: [05 — API deep dive](./api/05-api-deep-dive.md).

---

## Content security (XSS for posts)

When serving a post by slug, markdown is converted with `marked`, then HTML is cleaned with **DOMPurify** (`sanitizeHtml` in `content.util.ts`) using the HTML profile.

That reduces XSS risk when the web injects HTML with Astro `set:html` or when consumers render API `html`.

---

## Next

- Full API module walkthrough: [05 — API deep dive](./api/05-api-deep-dive.md)
- Guards internals: [06 — API common layer](./api/06-api-common-layer.md)
