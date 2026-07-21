# 11 — Current gaps & honesty map

This project is a solid skeleton of a secure CMS. Some parts are **fully wired**, some are **API-ready but UI-thin**, and some are **schema-only**.

Use this page so docs don’t oversell the code.

---

## Fully working (API + usable path)

| Area | Evidence |
|------|----------|
| Auth register/login/refresh/logout | Controllers + services + tests |
| JWT + roles + throttling + Helmet + validation | Global providers in `AppModule` / `main.ts` |
| Posts CRUD + publish + schedule consumer | Posts module + BullMQ |
| Markdown → sanitized HTML on `GET /posts/:slug` | `renderHtml` |
| Analytics views/claps/summary | Analytics module |
| Media upload to local WebP | Media service |
| Health checks | Health module |
| Web login + write form | React islands calling API |
| Blog index fetch with demo fallback | `blog/index.astro` |
| Theme toggle, TOC, clap button, copy button | Islands present |
| Docker Compose stack | postgres/redis/api/web |

---

## Partial / stubbed

| Area | What exists | What’s missing |
|------|-------------|----------------|
| Blog post pages | One static demo slug in `getStaticPaths` | Fetch all published posts from API at build time; regenerate on publish |
| Tag pages | Placeholder routes | Real filtered listing UI from API |
| `/app/posts` | Copy + link | Admin table calling `GET /posts/admin` |
| `/app/media` | Copy | Upload UI calling `POST /media/upload` |
| `/app/settings` | Copy about JWT/2FA | Real settings forms |
| Auth hydrate | `hydrateAuth` implemented | Call it on `/app` layout mount |
| Refresh token in UI | API + `credentials:'include'` | Auto-refresh when access token expires |
| 2FA | Entity + login check + `enableTwoFactor` service | HTTP endpoints + real TOTP + settings UI |
| S3 config | Env vars loaded | Actual S3 upload adapter (still local disk) |
| Serving `/uploads` | Files written to disk | Static file route / CDN / volume + reverse proxy |
| Comments | DB table + entity | Module, moderation API, web UI |
| Portfolio page | Static cards | Not API-driven |
| Seeds | Empty folder | First admin user seed script |

---

## Intentionally not present (vs older deleted trees)

Git may still show deleted `frontend/` / `backend/` paths from a previous Next.js + Nest/Prisma layout. **Current source of truth is `apps/web` + `apps/api`.**

Do not expect in `apps/web`:

- Next.js App Router
- Zustand
- Atomic design folders
- Storybook
- Playwright
- Insights dashboard page

---

## Suggested reading order for contributors

1. [Overview](./01-overview-and-architecture.md)
2. [Getting started](./02-getting-started.md)
3. [Database](./03-database-and-data-model.md)
4. [Auth](./04-auth-and-security.md)
5. [API](./api/05-api-deep-dive.md) + [common](./api/06-api-common-layer.md)
6. [Web](./web/07-web-deep-dive.md)
7. [Flows](./08-request-flows.md)
8. Come back here before assuming a feature is complete

---

## Observability (partial)

| Area | Status |
|------|--------|
| Pino logs + trace_id | ✅ API |
| Prometheus HTTP + pool metrics | ✅ `/metrics` |
| OTEL traces → Collector | ✅ API; web dev/preview only |
| Grafana dashboards | ✅ HTTP/pool panels work |
| Loki log panels | ⚠️ Loki runs; no log shipper yet |
| Trace UI in Grafana | ⚠️ Collector logs only |
| Dashboard metrics for scheduler/claps/cache | ❌ queries exist, counters not in code |

Full detail: [observability/07-gaps-and-runbook.md](./observability/07-gaps-and-runbook.md).

## Quick “where do I change X?”

| I want to change… | Start here |
|-------------------|------------|
| New API endpoint | `apps/api/src/modules/<feature>/` |
| Auth rules | `common/guards` + `@Public` / `@Roles` |
| DB columns | `database/entities` + migration |
| Env defaults | `config/configuration.ts` + `.env.example` |
| Public page | `apps/web/src/pages/...` |
| Interactive widget | `apps/web/src/components/*.tsx` + `client:load` |
| Design tokens | `styles/global.scss`, `_variables.scss`, `tailwind.config.mjs` |
| API base URL | `PUBLIC_API_URL` |
| Compose ports | `docker/docker-compose.yml` |
| Metrics / tracing / logs | `apps/api/src/common/metrics/*`, `tracing.ts`, `pino-logger.config.ts` |
| Grafana dashboards | `docker/grafana/dashboards/` |
