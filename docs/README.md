# PCMS Technical Documentation

This folder explains **what the Portfolio & Content Management System (PCMS) is**, **how the pieces fit together**, and **what happens under the hood** in each segment.

Jump to a specific file if you already know the big picture. Otherwise, follow the order below.

---

## Recommended reading order

### Part 1 — Foundations (start here)

1. [01 — Overview & architecture](./01-overview-and-architecture.md) — what PCMS is, monorepo layout, how API + web + DB + Redis fit together  
2. [02 — Getting started](./02-getting-started.md) — env vars, install, run locally, first API calls  
3. [03 — Database & data model](./03-database-and-data-model.md) — tables, relationships, migrations  
4. [04 — Auth & security](./04-auth-and-security.md) — JWT, cookies, roles, guards  

### Part 2 — Application code

5. [05 — API deep dive](./api/05-api-deep-dive.md) — NestJS modules, hexagonal ports/adapters, every route, services  
6. [Hexagonal architecture tutorial](./api/hexagonal-architecture-tutorial.md) — **start here for ports/adapters:** learn the pattern through auth, media, and posts  
7. [06 — API common layer](./api/06-api-common-layer.md) — guards, filters, interceptors, decorators  
8. [07 — Web deep dive](./web/07-web-deep-dive.md) — Astro pages, React islands, styles, API client  
9. [Astro tutorial](./web/astro-tutorial.md) — learn Astro through this repo (static output, islands, `getStaticPaths`)  
10. [08 — Request flows](./08-request-flows.md) — login, publish, schedule, clap (end-to-end stories)  

### Part 3 — Operations & quality

11. [09 — Docker & infrastructure](./09-docker-and-infrastructure.md) — Compose, Dockerfiles, ports  
12. [10 — Testing](./10-testing.md) — tutorial: Jest (API), Vitest (web), how mocks/coverage work, how to add tests  
13. [11 — Current gaps & honesty map](./11-current-gaps.md) — what is real vs stubbed (read before assuming a feature exists)  

### Part 4 — Observability (logs, metrics, traces, Grafana)

14. [Observability index](./observability/README.md) — three pillars, quick start, ports  
15. [Observability tutorial](./observability/observability-tutorial.md) — **start here:** hands-on how logs, metrics, traces, health & Grafana work in this repo  
16. [Observability 01 — Overview](./observability/01-overview.md) — how logging, metrics, and tracing connect  
17. [Observability 02 — Tracing](./observability/02-tracing.md) — OpenTelemetry, Collector, trace propagation  
18. [Observability 03 — Logging](./observability/03-logging.md) — Pino, `trace_id` in logs  
19. [Observability 04 — Metrics](./observability/04-metrics.md) — Prometheus `/metrics`, PromQL  
20. [Observability 05 — Health checks](./observability/05-health-checks.md) — liveness vs readiness  
21. [Observability 06 — Docker & Grafana](./observability/06-docker-stack-and-grafana.md) — dashboards, generating traffic  
22. [Observability 07 — Gaps & runbook](./observability/07-gaps-and-runbook.md) — troubleshooting, what is not wired yet  

### Short paths (if you are in a hurry)

| Goal | Read |
|------|------|
| Run the project today | **1 → 2** |
| Understand the API only | **1 → 3 → 4 → 5 → 6 (hexagonal tutorial) → 7** |
| Learn hexagonal / ports & adapters | **1 → 6** |
| Understand the frontend only | **1 → 8 → 9 (Astro tutorial) → 10** |
| Debug production / Docker | **2 → 11 → 13 → 14 → 21 → 22** |
| Learn observability (tutorial) | **14 → 15** |
| Set up Grafana & metrics | **14 → 15 → 19 → 21 → 22** |

---

## Full index

| Doc | What it covers |
|-----|----------------|
| [01 — Overview & architecture](./01-overview-and-architecture.md) | What PCMS is, monorepo layout, hexagonal API sketch, how API + web + DB + Redis talk |
| [02 — Getting started](./02-getting-started.md) | Env vars, install, local run, useful scripts |
| [03 — Database & data model](./03-database-and-data-model.md) | Tables, relationships, enums, migrations, TypeORM sync |
| [04 — Auth & security](./04-auth-and-security.md) | JWT, cookies, roles, rate limits, Helmet, validation |
| [05 — API deep dive](./api/05-api-deep-dive.md) | NestJS bootstrap, hexagonal architecture, modules, every route, services |
| [Hexagonal architecture tutorial](./api/hexagonal-architecture-tutorial.md) | Tutorial: ports & adapters through auth, media, posts — why choices were made |
| [06 — API common layer](./api/06-api-common-layer.md) | Guards, filters, interceptors, decorators, content utils |
| [07 — Web deep dive](./web/07-web-deep-dive.md) | Astro pages, React islands, styles, stores, API client |
| [Astro tutorial](./web/astro-tutorial.md) | Tutorial: how Astro works in PCMS (static SSG, islands, paths, data) |
| [08 — Request flows](./08-request-flows.md) | Step-by-step: login, publish, schedule, clap, health |
| [09 — Docker & infrastructure](./09-docker-and-infrastructure.md) | Compose services, Dockerfiles, ports, volumes |
| [10 — Testing](./10-testing.md) | Tutorial: run suites, Jest/Vitest setup, mock ports, write tests, 100% coverage gate |
| [11 — Current gaps & honesty map](./11-current-gaps.md) | What exists vs what is stubbed / incomplete |

### Observability

| Doc | What it covers |
|-----|----------------|
| [Observability index](./observability/README.md) | Three pillars, quick start, ports |
| [Observability tutorial](./observability/observability-tutorial.md) | Tutorial: follow a request through logs, metrics, traces, health, Grafana |
| [01 — Overview](./observability/01-overview.md) | Architecture, file map, `/metrics` vs `/api` |
| [02 — Tracing](./observability/02-tracing.md) | OpenTelemetry, Collector, trace propagation |
| [03 — Logging](./observability/03-logging.md) | Pino, trace_id in logs, Loki readiness |
| [04 — Metrics](./observability/04-metrics.md) | Prometheus metrics, PromQL, custom counters |
| [05 — Health checks](./observability/05-health-checks.md) | Liveness vs readiness |
| [06 — Docker & Grafana](./observability/06-docker-stack-and-grafana.md) | Compose stack, dashboards |
| [07 — Gaps & runbook](./observability/07-gaps-and-runbook.md) | Troubleshooting, what's not wired yet |

---

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
