# PCMS — Portfolio & Content Management System

Monorepo for a secure, Dockerized portfolio and blog CMS.

## Stack

| Layer | Technology |
|-------|------------|
| API | NestJS, TypeORM, PostgreSQL, Redis/BullMQ |
| Web | Astro (SSG/SSR), shadcn/ui, React islands, SCSS Modules |
| Tests | Jest (API, 100% coverage), Vitest (Web, 100% coverage) |
| Infra | Docker multi-stage builds, docker-compose |

## Structure

```text
apps/api   NestJS REST API
apps/web   Astro frontend + back office
docker/    Dockerfiles & compose
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
npm run test:api   # Jest + 100% coverage threshold
npm run test:web   # Vitest + 100% coverage threshold
```

## Docker (full stack)

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Security

- Helmet, strict CORS, global ValidationPipe
- JWT access tokens + HttpOnly SameSite=Strict refresh cookies
- RBAC (`ADMIN` / `EDITOR`), Redis-backed rate limiting
- DOMPurify sanitization for rendered Markdown
