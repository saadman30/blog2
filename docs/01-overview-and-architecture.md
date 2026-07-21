# 01 — Overview & architecture

## What is this project?

**PCMS** means **Portfolio & Content Management System**.

It is one repo that ships two apps:

1. **`apps/api`** — the brain. Stores users, posts, media metadata, analytics. Handles login, publishing, scheduling, uploads, and health checks.
2. **`apps/web`** — the face. A public portfolio + blog site, plus a small `/app` back office for login and writing posts.

They talk over HTTP. The web app calls `http://localhost:3001/api/...`. The API never renders HTML for the marketing site; Astro does that.

---

## High-level picture

```text
┌─────────────────────┐         HTTP JSON          ┌─────────────────────┐
│   apps/web (Astro)  │ ─────────────────────────► │   apps/api (NestJS)  │
│   port 4321         │ ◄───────────────────────── │   port 3001 (/api)   │
│                     │   { success, data }        │                     │
│  - static pages     │                            │  - auth / posts /    │
│  - React islands    │                            │    media / analytics │
│  - back office UI   │                            │  - health            │
└─────────────────────┘                            └──────────┬──────────┘
                                                              │
                                              ┌───────────────┼───────────────┐
                                              ▼               ▼               ▼
                                        PostgreSQL         Redis          Disk
                                        (TypeORM)       (BullMQ +       ./uploads
                                                         health)        (images)
```

**Simple English:**

- The **browser** loads pages from the web app.
- When a page needs live data (blog list, login, clap), the **browser or Astro build** calls the **API**.
- The API reads/writes **PostgreSQL**.
- For **scheduled posts**, the API puts a job in **Redis** (via BullMQ). A worker later flips the post to published.
- Uploaded images are processed with **Sharp**, saved as **WebP** under `./uploads`, served at `/uploads/*` by the API, and tracked in the `media` table.

---

## Monorepo layout

```text
blog/                          ← root package name: "pcms"
├── package.json               ← npm workspaces: apps/api, apps/web
├── package-lock.json
├── .env / .env.example        ← shared env for local + Docker
├── README.md                  ← short project intro
├── docs/                      ← this documentation
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── apps/
│   ├── api/                   ← @pcms/api  (NestJS)
│   └── web/                   ← @pcms/web  (Astro)
└── node_modules/              ← hoisted workspace installs
```

Root scripts (from root `package.json`) are shortcuts into workspaces:

| Script | What it does |
|--------|----------------|
| `npm run dev:api` | Nest watch mode |
| `npm run dev:web` | Astro dev server |
| `npm run build` | Build API then web |
| `npm run test:api` | Jest with coverage |
| `npm run test:web` | Vitest with coverage |
| `npm run lint` | Lint both apps |

Node version: **>= 20**.

---

## Tech stack (truth table)

| Layer | Technology | Role |
|-------|------------|------|
| API framework | NestJS 10 | Modules, DI, controllers, guards |
| ORM | TypeORM 0.3 | Entities, repositories, migrations |
| Database | PostgreSQL 16 | Persistent data |
| Queue | BullMQ + Redis 7 | Delayed “publish this post” jobs |
| Auth | JWT + Passport + bcrypt | Access token in body; refresh in cookie |
| Validation | class-validator | Strip/reject bad request bodies |
| Content | marked + DOMPurify | Markdown → safe HTML |
| Images | Sharp | Convert uploads to WebP |
| Web framework | Astro 5 (`output: 'static'`) | File-based routes, SSG |
| Interactive UI | React 19 islands | Forms, theme toggle, clap button |
| UI primitives | shadcn-style + Radix + Tailwind | Button, Card, Dialog, Input, Badge |
| Client state | nanostores | Auth token + user in memory/sessionStorage |
| Styles | Tailwind + SCSS partials + Astro scoped SCSS | Tokens, layouts, page styles |
| API tests | Jest | Unit tests, 100% coverage target |
| Web tests | Vitest | Utils/stores/UI primitives, 100% on included paths |

---

## Architecture style of the API

The API uses **hexagonal architecture** (also called **ports & adapters**) inside Nest feature modules.

### Why

Business rules should not know about Nest controllers, TypeORM, BullMQ, Sharp, or Redis. Those are **details**. Hexagonal keeps the core independent so you can:

- unit-test application logic by mocking ports (no real DB or queue)
- swap an adapter later (e.g. local disk → S3) without rewriting use cases
- read a feature as “what it does” (`application/`) vs “how it talks to the world” (`infrastructure/`)

### The idea in one picture

Imagine the **application** at the center. Everything outside talks through a **port** (an interface the app defines). An **adapter** is a concrete implementation of that port.

```text
                    ┌─────────────────────────────────────┐
                    │         Driving adapters            │
                    │  HTTP controllers, BullMQ consumer  │
                    └─────────────────┬───────────────────┘
                                      │ calls
                                      ▼
┌──────────────┐            ┌──────────────────┐            ┌──────────────┐
│   Domain     │◄───────────│   Application    │───────────►│    Ports     │
│ plain models │            │  services /      │  depends   │  interfaces  │
│ & enums      │            │  use cases       │  on        │  + tokens    │
└──────────────┘            └──────────────────┘            └──────┬───────┘
                                                                   │
                                                                   │ implemented by
                                                                   ▼
                                                    ┌──────────────────────────┐
                                                    │   Driven adapters        │
                                                    │ TypeORM, BullMQ, bcrypt, │
                                                    │ Sharp, local fs, Redis   │
                                                    └──────────────────────────┘
```

**Driving** (inbound): the outside world pushes work in — HTTP request, scheduled job.  
**Driven** (outbound): the app pulls work out — save a post, hash a password, enqueue publish.

### Request path (this codebase)

```text
HTTP request
    → Guard (JWT? role? rate limit?)
    → Controller (driving adapter → application service)
    → Application service (business rules via ports)
    → Persistence / queue / storage adapters (TypeORM, BullMQ, …)
    → PostgreSQL / Redis / disk
    → Interceptor wraps success as { success: true, data }
    → Or Filter wraps errors as { success: false, ... }
```

### Folder meaning per feature

Each feature lives in `apps/api/src/modules/<name>/`:

| Folder | Role |
|--------|------|
| `domain/` | Plain TypeScript models (no Nest, no TypeORM) |
| `application/ports/` | Interfaces + injection tokens the app needs |
| `application/*.service.ts` | Business rules; depends on **ports only** |
| `infrastructure/` | Adapters: `http/`, `persistence/`, messaging, storage, security, … |
| `*.module.ts` | Nest composition root: bind each port token → adapter class |

Shared kernel enums/models live in `apps/api/src/domain/`. Cross-cutting Nest code stays in `apps/api/src/common/`. TypeORM entities stay in `apps/api/src/database/entities/` (persistence detail, not domain).

### Features

- `auth` — register, login, refresh, logout
- `posts` — CRUD, publish, schedule, markdown render
- `media` — upload / list / delete images
- `analytics` — views, claps, summary
- `health` — DB + Redis checks

For a full tutorial (auth/media/posts walkthroughs, why Symbol tokens, how to add a port), see [Hexagonal architecture tutorial](./api/hexagonal-architecture-tutorial.md). For the shorter reference plus every route, see [05 — API deep dive](./api/05-api-deep-dive.md#hexagonal-architecture).

---

## Architecture style of the web

Astro is configured with **`output: 'static'`**.

That means:

1. Pages under `src/pages/` become HTML files at build time.
2. Interactive pieces are **React components** hydrated with `client:load`.
3. Production Docker image serves the built `dist/` with the `serve` static file server — **not** Astro SSR.

**Implication for blog data:**

- The blog **index** fetches `GET /api/posts` during the Astro page run (dev/build). If the API is down, it falls back to a demo post.
- The blog **post detail** page currently uses a **hardcoded** `getStaticPaths()` demo post (`welcome-to-pcms`). It does not yet fetch all published slugs from the API at build time.

---

## Response contract (API ↔ web)

Successful responses are wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "data": { /* whatever the controller returned */ }
}
```

Errors are shaped by `HttpExceptionFilter`:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Authentication required",
  "error": "Unauthorized",
  "timestamp": "...",
  "path": "/api/posts"
}
```

The web `apiFetch()` helper unwraps `data` on success and throws `ApiClientError` on failure.

---

## Who owns what?

| Concern | Owner |
|---------|--------|
| User accounts, passwords, roles | API `auth` + `users` table |
| Post content (markdown) | API `posts` + `posts` table |
| Rendered HTML for a post | API `PostsService.renderHtml()` on `GET /posts/:slug` |
| Public HTML pages | Web Astro layouts/pages |
| Access token storage in browser | Web `auth-store` (sessionStorage) |
| Refresh token storage | API sets httpOnly cookie `refreshToken` |
| Image bytes on disk | API media service → `MEDIA_LOCAL_PATH` |
| Image metadata | `media` table |
| Views / claps | `analytics` table |
| Scheduled publish | BullMQ queue `post-scheduler` on Redis |
| Comments | Table exists; **no API module yet** |

See [11 — Current gaps](./11-current-gaps.md) for incomplete pieces.

---

## Next

- Set up and run: [02 — Getting started](./02-getting-started.md)
- Tables and relations: [03 — Database](./03-database-and-data-model.md)
