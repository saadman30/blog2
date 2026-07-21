# 05 — API deep dive (`apps/api`)

Package name: **`@pcms/api`**

Entry point: `src/main.ts`  
Root module: `src/app.module.ts`

---

## Folder map

```text
apps/api/src/
├── main.ts                 # bootstrap: prefix, helmet, cors, validation, listen
├── app.module.ts           # wires config, TypeORM, BullMQ, throttler, modules, global providers
├── config/
│   ├── configuration.ts    # env → typed config namespaces
│   └── typeorm.data-source.ts  # CLI migrations data source
├── database/
│   ├── entities/           # TypeORM models
│   ├── migrations/         # SQL schema history
│   └── seeds/              # empty placeholder
├── common/                 # shared guards/filters/utils (see doc 06)
└── modules/
    ├── auth/
    ├── posts/
    ├── media/
    ├── analytics/
    └── health/
```

Every feature module typically has:

- `*.module.ts` — Nest wiring
- `*.controller.ts` — HTTP routes
- `*.service.ts` — business logic
- `*.spec.ts` — unit tests
- `dto/` when needed

---

## Bootstrap (`main.ts`) step by step

1. `NestFactory.create(AppModule)` (Express adapter)
2. Read `ConfigService`
3. `useStaticAssets(MEDIA_LOCAL_PATH, { prefix: '/uploads/' })` — serve uploaded WebP files
4. `setGlobalPrefix('api')` → all routes start with `/api`
5. `helmet()`
6. `cookieParser()`
7. `enableCors(...)` using `app.corsOrigin`
8. Global `ValidationPipe`
9. `listen(port, host)` — defaults `3001` / `0.0.0.0`

---

## Config namespaces

From `configuration.ts` (via `ConfigModule.forRoot({ load: [...] })`):

| Namespace | Keys (env) |
|-----------|------------|
| `app` | NODE_ENV, API_PORT, API_HOST, CORS_ORIGIN |
| `database` | DATABASE_HOST/PORT/USER/PASSWORD/NAME |
| `redis` | REDIS_HOST, REDIS_PORT |
| `jwt` | JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, expires |
| `media` | S3_*, MEDIA_LOCAL_PATH |

Access pattern in code: `config.get('database.host')`.

---

## Module: Auth

**Files:** `modules/auth/*`

### Routes (`AuthController`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | Public | Rate limit 5/min; sets refresh cookie; returns user + accessToken |
| POST | `/api/auth/login` | Public | Rate limit 10/min; optional 2FA code |
| POST | `/api/auth/refresh` | Public | Reads cookie `refreshToken`; returns new accessToken |
| POST | `/api/auth/logout` | Public | Clears refresh cookie |

### Service responsibilities (`AuthService`)

| Method | What it does |
|--------|----------------|
| `register` | Reject duplicate email; hash password; assign role **EDITOR** (not client-selectable); issue tokens |
| `login` | Verify password; optional 2FA; issue tokens |
| `refresh` | Verify refresh JWT with refresh secret; re-issue pair |
| `validateUserById` | Used by JWT strategy after decoding access token |
| `enableTwoFactor` | Store secret + flip flag (no HTTP route yet) |
| `issueTokens` | Sign access + refresh JWTs with role/email/sub |
| `sanitizeUser` | Remove secrets before returning user JSON |

### JWT strategy

`strategies/jwt.strategy.ts`:

- Extracts Bearer token from Authorization header
- Validates with access secret
- Loads user from DB by `payload.sub`
- Attaches user to request

---

## Module: Posts

**Files:** `modules/posts/*`

Queue name constant: `POST_SCHEDULER_QUEUE = 'post-scheduler'`.

### Routes (`PostsController`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/posts` | ADMIN/EDITOR | Create post |
| GET | `/api/posts/admin` | ADMIN/EDITOR | All statuses + author relation |
| GET | `/api/posts/id/:id` | ADMIN/EDITOR | Single post by id |
| GET | `/api/posts` | Public | Published only; optional `?tag=` |
| GET | `/api/posts/:slug` | Public | Published by slug + rendered `html` field |
| PATCH | `/api/posts/:id` | ADMIN/EDITOR | Partial update |
| DELETE | `/api/posts/:id` | ADMIN | Delete |

**Route ordering note:** static paths like `admin` and `id/:id` are declared before `:slug` so they are not swallowed by the slug param.

### Create flow (`PostsService.create`)

1. Default status = `DRAFT` if omitted
2. Validate schedule rules (scheduled posts need a future `scheduledAt`)
3. Build unique slug from provided slug or title
4. Estimate reading time from markdown
5. Set `publishedAt` immediately if status is `PUBLISHED`
6. Save post
7. Create analytics row (0 views, 0 claps)
8. If `SCHEDULED`, enqueue BullMQ delayed job

### Update flow

- Merges fields
- Recomputes reading time if content changes
- Can change status / schedule
- Re-enqueues publish job when scheduling

### Render HTML

`renderHtml(content)`:

1. `marked` parses markdown → HTML
2. `sanitizeHtml` (DOMPurify) cleans it
3. Returned as `html` on public slug endpoint

### Scheduler consumer

`post-scheduler.consumer.ts`:

- Listens to BullMQ queue
- Job name: `publish-post`; payload: `{ postId }`
- Publishes the post if still `SCHEDULED` and `scheduledAt` is due

**Redis is required** for scheduling to work. Without Redis, creating a scheduled post will fail when enqueueing.

### DTOs (`post.dto.ts`)

**CreatePostDto** fields (validated):

- `title` (required)
- `slug?`, `content` (required), `summary?`
- `status?` enum
- `scheduledAt?` ISO date string
- `tags?` string array
- `category?`

**UpdatePostDto:** same fields, all optional.

---

## Module: Media

### Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/media/upload` | ADMIN/EDITOR | multipart upload |
| GET | `/api/media` | ADMIN/EDITOR | list |
| DELETE | `/api/media/:id` | ADMIN | delete file + row |

### Upload pipeline (`MediaService.upload`)

1. Generate `uuid.webp` key
2. Ensure `MEDIA_LOCAL_PATH` directory exists
3. Convert buffer with Sharp → WebP quality 80
4. Write file to disk
5. Save DB row with url `/uploads/<key>`, mime `image/webp`, size, optional alt

**S3 env vars exist in config but are not used by the current upload implementation** — storage is local filesystem.

Uploaded files are served at **`http://localhost:3001/uploads/<key>`** via Express static assets in `main.ts` (not under the `/api` prefix). In production behind a reverse proxy, you may still want a CDN or dedicated volume for persistence.

---

## Module: Analytics

### Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/analytics` | ADMIN/EDITOR | Global totals |
| POST | `/api/analytics/:postId/view` | Public | +1 view |
| POST | `/api/analytics/:postId/clap` | Public | +N claps (1–50) |
| GET | `/api/analytics/:postId` | Public | Per-post stats |

### Rules

- Analytics only for **published** posts (`getOrCreate` checks status)
- Clap count clamped to 1..50 per request
- Summary reduces all analytics rows for total views/claps + count

---

## Module: Health

### Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | Public | DB + Redis + uptime |
| GET | `/api/health/live` | Public | Always-ok liveness |

`HealthService.check()`:

- DB: run `SELECT 1`
- Redis: ping with ioredis using configured host/port
- Returns status fields `ok` / `error`

Useful for Docker/K8s probes and local debugging.

---

## Global response shape reminder

Controllers return plain objects/entities.  
`TransformInterceptor` wraps them:

```json
{ "success": true, "data": <controller return value> }
```

Exceptions become:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "...",
  "error": "...",
  "timestamp": "...",
  "path": "..."
}
```

---

## Dependencies that matter

| Package | Why |
|---------|-----|
| `@nestjs/*` | Framework |
| `typeorm` + `pg` | Postgres |
| `@nestjs/bullmq` + `bullmq` + `ioredis` | Jobs + Redis |
| `passport-jwt` / `@nestjs/jwt` | Auth |
| `bcrypt` | Passwords |
| `class-validator` | DTOs |
| `marked` + `isomorphic-dompurify` | Safe HTML |
| `sharp` | Images |
| `helmet` | Headers |
| `@nestjs/throttler` | Rate limits |
| `cookie-parser` | Refresh cookie |

---

## Next

- Shared plumbing: [06 — API common layer](./06-api-common-layer.md)
- End-to-end stories: [08 — Request flows](../08-request-flows.md)
