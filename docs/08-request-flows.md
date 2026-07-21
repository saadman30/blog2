# 08 — Request flows

These are end-to-end stories. Each one shows **who calls whom** and **what changes**.

---

## Flow A — Register / login

```text
Browser (/app LoginForm)
  → POST /api/auth/login  { email, password }
API AuthController
  → AuthService.login
      → find user by email
      → bcrypt.compare
      → optional 2FA check
      → issueTokens (access + refresh JWTs)
  → Set-Cookie: refreshToken=...; HttpOnly; Path=/api/auth
  → JSON body: { success:true, data:{ user, accessToken } }
Browser
  → setAuth(user, accessToken) → nanostore + sessionStorage
```

Later API calls from WriteForm:

```text
Authorization: Bearer <accessToken>
```

Refresh (not wired in UI yet, but API supports it):

```text
Browser
  → POST /api/auth/refresh   (cookie sent automatically)
API
  → verify refresh JWT
  → issue new tokens
  → set new refresh cookie
  → return { accessToken }
```

---

## Flow B — Create & publish a post

```text
WriteForm (must have token)
  → POST /api/posts
     Authorization: Bearer …
     body: { title, content, status: "PUBLISHED", tags? }
JwtAuthGuard → RolesGuard (ADMIN|EDITOR)
PostsController.create → PostsService.create
  → slugify / ensure unique slug
  → estimateReadingTime
  → publishedAt = now
  → INSERT posts
  → INSERT analytics (0,0)
  → return post entity
TransformInterceptor wraps response
```

Public list:

```text
Astro /blog frontmatter OR curl
  → GET /api/posts
PostsService.findPublished
  → WHERE status = PUBLISHED ORDER BY publishedAt DESC
```

Public detail (API):

```text
GET /api/posts/:slug
  → find published by slug (+ author, analytics)
  → renderHtml(markdown) → { ...post, html }
```

Web detail page currently uses static demo props, not this API response — keep that distinction in mind.

---

## Flow C — Schedule a post

```text
POST /api/posts
  { status: "SCHEDULED", scheduledAt: "2026-07-22T10:00:00.000Z", ... }
PostsService.create
  → assertScheduleValid (must have scheduledAt)
  → save with status SCHEDULED
  → enqueuePublish(postId, scheduledAt)
       BullMQ job on queue "post-scheduler" with delay until scheduledAt
Redis holds the delayed job
... time passes ...
PostSchedulerConsumer.process(job)
  → load post
  → if still scheduled and due → status=PUBLISHED, publishedAt=now, save
```

If Redis is down, enqueue fails and create/update of scheduled posts fails.

---

## Flow D — Clap on a post

```text
ClapButton (client island)
  → optimistic local +1
  → POST /api/analytics/:postId/clap  { count?: number }
AnalyticsService.clap
  → clamp count to 1..50
  → getOrCreate analytics for PUBLISHED post
  → claps += count
  → save
```

Views work the same with `/view` (+1 only). The current post page island does not auto-fire views; only clap is wired in UI.

---

## Flow E — Upload media

```text
Client (not fully built in web UI yet)
  → POST /api/media/upload  multipart file (+ optional alt)
MediaService.upload
  → sharp → webp
  → write ./uploads/<uuid>.webp
  → INSERT media row
  → return { url: "/uploads/...", ... }
```

Delete (ADMIN): remove file (ignore missing) + delete row.

---

## Flow F — Health check

```text
GET /api/health/live
  → cheap “process is up” signal

GET /api/health
  → SELECT 1 against Postgres
  → Redis PING
  → return { status, database, redis, uptime }
```

Compose / ops can use these for readiness.

---

## Flow G — Blog index with API down

```text
astro build / astro dev loads /blog
  → fetch PUBLIC_API_URL/posts
  → network error OR non-OK
  → catch → inject demo post "Welcome to PCMS"
Page still renders
```

This keeps SSG builds from hard-failing when the API is offline.

---

## Sequence: authenticated write (compact)

```text
User → Web Login → API login → accessToken in sessionStorage
User → Web WriteForm → API POST /posts (Bearer) → DB post + analytics
Public → Web /blog → API GET /posts → cards
```

---

## Next

- [09 — Docker & infrastructure](./09-docker-and-infrastructure.md)
- [11 — Current gaps](./11-current-gaps.md) (where UI/API don’t fully meet yet)
