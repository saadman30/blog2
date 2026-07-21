# PCMS — Portfolio & Content Management System

Monorepo for a secure, Dockerized portfolio and blog CMS.

## Technical documentation

Detailed under-the-hood docs (architecture, API, web, auth, DB, Docker, flows, gaps):

**→ [docs/README.md](./docs/README.md)**

## Stack

| Layer | Technology |
|-------|------------|
| API | NestJS, TypeORM, PostgreSQL, Redis/BullMQ |
| Web | Astro (static SSG), shadcn/ui, React islands, Tailwind + SCSS |
| Tests | Jest (API), Vitest (Web) — high coverage thresholds on measured paths |
| Infra | Docker multi-stage builds, docker-compose |

## Structure

```text
apps/api   NestJS REST API
apps/web   Astro frontend + back office
docker/    Dockerfiles & compose
docs/      Technical documentation
```

## Quick start

```bash
cp .env.example .env
npm install
docker compose -f docker/docker-compose.yml up -d postgres redis
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:4321
```

## Tests

```bash
npm run test:api   # Jest + coverage threshold
npm run test:web   # Vitest + coverage threshold
```

## Docker (full stack)

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Security

- Helmet, strict CORS, global ValidationPipe
- JWT access tokens + HttpOnly SameSite=Strict refresh cookies
- RBAC (`ADMIN` / `EDITOR`), rate limiting
- DOMPurify sanitization for rendered Markdown
