# PCMS Technical Documentation

This folder explains **what the Portfolio & Content Management System (PCMS) is**, **how the pieces fit together**, and **what happens under the hood** in each segment.

Read these in order if you are new. Jump to a specific file if you already know the big picture.

| Doc | What it covers |
|-----|----------------|
| [01 — Overview & architecture](./01-overview-and-architecture.md) | What PCMS is, monorepo layout, how API + web + DB + Redis talk |
| [02 — Getting started](./02-getting-started.md) | Env vars, install, local run, useful scripts |
| [03 — Database & data model](./03-database-and-data-model.md) | Tables, relationships, enums, migrations, TypeORM sync |
| [04 — Auth & security](./04-auth-and-security.md) | JWT, cookies, roles, rate limits, Helmet, validation |
| [05 — API deep dive](./api/05-api-deep-dive.md) | NestJS bootstrap, modules, every route, services |
| [06 — API common layer](./api/06-api-common-layer.md) | Guards, filters, interceptors, decorators, content utils |
| [07 — Web deep dive](./web/07-web-deep-dive.md) | Astro pages, React islands, styles, stores, API client |
| [08 — Request flows](./08-request-flows.md) | Step-by-step: login, publish, schedule, clap, health |
| [09 — Docker & infrastructure](./09-docker-and-infrastructure.md) | Compose services, Dockerfiles, ports, volumes |
| [10 — Testing](./10-testing.md) | Jest (API), Vitest (web), coverage rules |
| [11 — Current gaps & honesty map](./11-current-gaps.md) | What exists vs what is stubbed / incomplete |

### Observability (logs, metrics, traces, Grafana)

| Doc | What it covers |
|-----|----------------|
| [Observability index](./observability/README.md) | Three pillars, quick start, ports |
| [01 — Overview](./observability/01-overview.md) | Architecture, file map, `/metrics` vs `/api` |
| [02 — Tracing](./observability/02-tracing.md) | OpenTelemetry, Collector, trace propagation |
| [03 — Logging](./observability/03-logging.md) | Pino, trace_id in logs, Loki readiness |
| [04 — Metrics](./observability/04-metrics.md) | Prometheus metrics, PromQL, custom counters |
| [05 — Health checks](./observability/05-health-checks.md) | Liveness vs readiness |
| [06 — Docker & Grafana](./observability/06-docker-stack-and-grafana.md) | Compose stack, dashboards |
| [07 — Gaps & runbook](./observability/07-gaps-and-runbook.md) | Troubleshooting, what's not wired yet |

## One-sentence summary

**PCMS** is an npm workspaces monorepo: a **NestJS REST API** (`apps/api`) backed by **PostgreSQL + Redis**, and an **Astro static site** (`apps/web`) with React islands for interactive bits and a thin back office.

## Ports you will see often

| Service | Port | URL |
|---------|------|-----|
| Web (Astro) | `4321` | http://localhost:4321 |
| API (NestJS) | `3001` | http://localhost:3001/api |
| PostgreSQL | `5432` | — |
| Redis | `6379` | — |
| Grafana | `3000` | http://localhost:3000 |
| Prometheus | `9090` | http://localhost:9090 |
| OTel Collector (HTTP) | `4318` | OTLP traces |
| Loki | `3100` | — |
| API metrics | `3001` | http://localhost:3001/metrics |
