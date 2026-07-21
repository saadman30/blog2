# 03 — Database & data model

## What stores data?

**PostgreSQL**, accessed through **TypeORM**.

There is **no Prisma** in the current PCMS tree. Entities live under:

`apps/api/src/database/entities/`

---

## How the API connects

In `app.module.ts`, TypeORM is configured asynchronously from ConfigService:

- Host, port, username, password, database name from env
- Entity list: User, Post, Media, Comment, Analytics
- `synchronize: true` **only when** `NODE_ENV === 'development'`
- SQL logging also only in development

**What synchronize means in simple English:** TypeORM looks at your entity classes and tries to make the database tables match them automatically. Convenient for local hacking. Risky for production (can drop/alter columns unexpectedly). Production should rely on **migrations**.

---

## Entity relationship diagram

```text
users 1 ─── * posts
users 1 ─── * comments          (optional author)
posts 1 ─── * comments
posts 1 ─── 1 analytics
media                         (standalone; no FK to posts yet)
```

---

## Tables in detail

### `users`

File: `user.entity.ts`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | Auto-generated |
| `email` | string, unique | Stored lowercased on register/login |
| `password` | string | bcrypt hash (cost 12) |
| `role` | enum | `ADMIN` or `EDITOR` — public register always creates `EDITOR` |
| `twoFactorSecret` | string \| null | Used when 2FA enabled |
| `twoFactorEnabled` | boolean | Default false |
| `createdAt` / `updatedAt` | timestamps | |

Relations:

- `posts` — one user authors many posts
- `comments` — one user may author many comments

Roles enum file: `user-role.enum.ts`.

---

### `posts`

File: `post.entity.ts`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `title` | string | |
| `slug` | string, unique | URL-friendly id; auto from title if omitted |
| `content` | text | **Markdown** source of truth |
| `summary` | text \| null | Short blurb for cards |
| `readingTime` | int | Minutes; estimated ~200 wpm |
| `status` | enum | `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` |
| `scheduledAt` | timestamptz \| null | When a scheduled post should go live |
| `publishedAt` | timestamptz \| null | Set when status becomes published |
| `tags` | text[] | Postgres array; filter with `ANY` |
| `category` | string \| null | Optional single category |
| `authorId` | uuid FK → users | Cascade delete if user deleted |
| `createdAt` / `updatedAt` | timestamps | |

Relations:

- `author` → User
- `comments` → Comment[]
- `analytics` → Analytics (one-to-one)

Status enum file: `post-status.enum.ts`.

**Status meanings:**

| Status | Meaning |
|--------|---------|
| `DRAFT` | Work in progress; not on public list |
| `SCHEDULED` | Waiting for `scheduledAt`; BullMQ job enqueued |
| `PUBLISHED` | Visible on public `GET /posts` |
| `ARCHIVED` | Kept but not treated as published in public queries |

---

### `analytics`

File: `analytics.entity.ts`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `postId` | uuid, unique FK → posts | Cascade delete with post |
| `views` | int | Incremented by public view endpoint |
| `claps` | int | Medium-style appreciation counter |
| timestamps | | |

Created automatically when a post is created (zeros), and also lazily via `getOrCreate` for published posts.

---

### `media`

File: `media.entity.ts`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `url` | string | e.g. `/uploads/<uuid>.webp` |
| `key` | string | Filename on disk |
| `mimeType` | string | Always `image/webp` after processing |
| `size` | bigint | Byte size of WebP buffer |
| `alt` | string \| null | Accessibility text |
| timestamps | | |

No foreign key to posts yet — media is a library, not inline attachments.

---

### `comments`

File: `comment.entity.ts`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `content` | text | |
| `isApproved` | boolean | Moderation flag |
| `postId` | uuid FK → posts | Cascade delete |
| `authorId` | uuid \| null FK → users | Set null if user deleted |
| timestamps | | |

**Important:** the table + entity exist, but there is **no Comments Nest module / controller** yet. Comments are schema-ready, API-not-wired.

---

## Initial migration

File: `apps/api/src/database/migrations/1720000000000-InitSchema.ts`

Creates:

1. `uuid-ossp` extension
2. Enums `users_role_enum`, `posts_status_enum`
3. All five tables with FKs and unique constraints

`down()` drops tables and enums in reverse order.

Seeds folder `database/seeds/` exists but is empty — no seed script ships yet.

---

## How business code touches the DB

Services inject repositories:

```typescript
@InjectRepository(PostEntity)
private readonly postsRepository: Repository<PostEntity>
```

Examples of query styles used:

- `find` / `findOne` for simple lookups
- `createQueryBuilder` for published posts + tag filter (`:tag = ANY(post.tags)`)
- `save` for create/update
- `remove` for deletes

---

## Reading time & slug rules (derived fields)

Not separate tables — computed in the posts service / content util:

- **Slug:** lowercased title, non-word chars stripped, spaces → hyphens; uniqueness enforced by appending suffixes if needed
- **Reading time:** `ceil(wordCount / 200)`, minimum 1 minute

---

## Next

- How users prove who they are: [04 — Auth & security](./04-auth-and-security.md)
- How services use these tables: [05 — API deep dive](./api/05-api-deep-dive.md)
