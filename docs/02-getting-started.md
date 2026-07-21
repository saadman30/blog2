# 02 — Getting started

## Prerequisites

- **Node.js 20+**
- **npm** (lockfile is `package-lock.json`; this is npm workspaces, not pnpm)
- **Docker** (recommended for Postgres + Redis)

---

## 1. Copy environment file

```bash
cp .env.example .env
```

Root `.env` is used by local API and by Docker Compose (`env_file` points at `.env.example` in compose; for local API, Nest’s ConfigModule loads from process env / `.env` depending on how you start it — keep a real `.env` for secrets).

### What each variable means

#### API process

| Variable | Meaning | Default / example |
|----------|---------|-------------------|
| `NODE_ENV` | `development` enables TypeORM `synchronize` + SQL logging | `development` |
| `API_PORT` | Nest listen port | `3001` |
| `API_HOST` | Bind address | `0.0.0.0` |
| `CORS_ORIGIN` | Allowed browser origin (must match web URL) | `http://localhost:4321` |

#### Database

| Variable | Meaning |
|----------|---------|
| `DATABASE_HOST` | Postgres host (`localhost` locally, `postgres` in Docker) |
| `DATABASE_PORT` | Usually `5432` |
| `DATABASE_USER` | Default `pcms` |
| `DATABASE_PASSWORD` | Default `pcms_secret` |
| `DATABASE_NAME` | Default `pcms` |

#### Redis

| Variable | Meaning |
|----------|---------|
| `REDIS_HOST` | Redis host (`localhost` locally, `redis` in Docker) |
| `REDIS_PORT` | Usually `6379` |

#### JWT

| Variable | Meaning |
|----------|---------|
| `JWT_ACCESS_SECRET` | Signs short-lived access tokens (use a long random string in prod) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` |

#### Media / S3 placeholders

| Variable | Meaning |
|----------|---------|
| `S3_*` | Present in config for future S3; **current upload path is local disk** |
| `MEDIA_LOCAL_PATH` | Folder for WebP files (default `./uploads`) |

#### Web

| Variable | Meaning |
|----------|---------|
| `PUBLIC_API_URL` | Base URL Astro/browser use for API calls | `http://localhost:3001/api` |

`PUBLIC_` prefix matters in Astro: it is exposed to client-side code.

---

## 2. Install dependencies

From repo root:

```bash
npm install
```

This installs both `@pcms/api` and `@pcms/web` via workspaces.

---

## 3. Start Postgres + Redis

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

Wait until healthchecks pass. Compose defines:

- Postgres user/db/password matching `.env.example`
- Redis on `6379`
- Named volume `postgres_data` so data survives container restarts

---

## 4. Run the API

```bash
npm run dev:api
```

What happens:

1. Nest boots `AppModule`
2. TypeORM connects to Postgres
3. In **development**, `synchronize: true` creates/updates tables from entities (handy for local; use migrations for production discipline)
4. BullMQ connects to Redis
5. Server listens on `http://0.0.0.0:3001` with global prefix `/api`

Smoke check:

```bash
curl http://localhost:3001/api/health/live
```

Expected shape (after interceptor): `{ "success": true, "data": { "status": "ok" } }` (exact inner payload depends on controller return — live endpoint returns a simple ok object).

Full health (DB + Redis):

```bash
curl http://localhost:3001/api/health
```

---

## 5. Run the web app

```bash
npm run dev:web
```

Open http://localhost:4321

Astro serves on port **4321** (`astro.config.mjs`).

---

## 6. First useful API calls

### Register an editor/admin

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"long-enough-password","role":"ADMIN"}'
```

Response includes `accessToken` + `user`. A `refreshToken` cookie is also set (path `/api/auth`).

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"email":"you@example.com","password":"long-enough-password"}'
```

### Create a published post

```bash
TOKEN='paste-access-token'
curl -X POST http://localhost:3001/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","content":"## Hi\n\nWorld","status":"PUBLISHED","tags":["meta"]}'
```

### List published posts (public)

```bash
curl http://localhost:3001/api/posts
```

---

## Full stack via Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

This starts postgres, redis, api, and web.

Notes:

- API container gets `DATABASE_HOST=postgres` and `REDIS_HOST=redis` (overrides localhost).
- Web image bakes `PUBLIC_API_URL=http://localhost:3001/api` at **build** time — that URL is what the **browser** will call from your machine, which is intentional for local Docker demos.

---

## Database migrations (API)

Scripts in `apps/api/package.json`:

```bash
npm run migration:run -w @pcms/api
npm run migration:generate -w @pcms/api -- src/database/migrations/Name
npm run migration:revert -w @pcms/api
```

Data source file: `apps/api/src/config/typeorm.data-source.ts`.

Initial migration: `apps/api/src/database/migrations/1720000000000-InitSchema.ts`.

In local **development**, entity `synchronize` often means you can skip migrations. Prefer migrations when you care about repeatable production schema.

---

## Tests

```bash
npm run test:api
npm run test:web
```

See [10 — Testing](./10-testing.md).

---

## Common problems

| Symptom | Likely cause |
|---------|----------------|
| API fails on boot | Postgres/Redis not running or wrong host |
| CORS errors in browser | `CORS_ORIGIN` ≠ web origin (must be `http://localhost:4321`) |
| Blog list empty / demo only | API down when Astro fetched `/posts`, or no published posts |
| Write form says “Authentication required” | Not logged in on `/app`, or page refresh without calling `hydrateAuth` |
| Upload fails | `MEDIA_LOCAL_PATH` not writable |

---

## Next

- [03 — Database](./03-database-and-data-model.md)
- [04 — Auth & security](./04-auth-and-security.md)
