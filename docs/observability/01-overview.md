# 01 — Observability overview

## What “observability” means here

**Observability** means you can understand the system from the outside — without adding a new `console.log` and redeploying every time something breaks.

PCMS uses the classic **three pillars**:

| Pillar | Tool in PCMS | What you learn |
|--------|--------------|----------------|
| **Logs** | Pino (JSON to stdout) | What the app said at each step (errors, debug info) |
| **Metrics** | Prometheus scraping `/metrics` | Request rate, latency, errors, memory, DB pool size |
| **Traces** | OpenTelemetry → OTLP → Collector | One request’s path across HTTP handlers and outbound calls |

These three are **linked**: every HTTP log line can include `trace_id` and `span_id` from the active OpenTelemetry span, so you can jump from a slow metric → a log line → (eventually) a trace.

---

## Big picture diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Your machine / Docker                            │
│                                                                          │
│  Browser ──► Web (4321) ──trace headers──► API (3001)                   │
│                 │                              │                         │
│                 │ OTEL traces                  │ OTEL traces              │
│                 │ (dev/preview)                │ + Pino logs (stdout)     │
│                 │                              │ + /metrics               │
│                 ▼                              ▼                         │
│         ┌──────────────────────────────────────────┐                    │
│         │     OpenTelemetry Collector (:4317/4318)  │                    │
│         │     receives OTLP traces                  │                    │
│         │     (currently logs traces to console)    │                    │
│         └──────────────────────────────────────────┘                    │
│                                                                          │
│  Prometheus (:9090) ──scrapes──► GET http://api:3001/metrics             │
│                                                                          │
│  Loki (:3100) ◄── (logs need a shipper — see gaps doc)                   │
│                                                                          │
│  Grafana (:3000) ──queries──► Prometheus + Loki                          │
│       dashboards: PCMS Overview, PCMS API Observability                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Simple English:**

- The **API** is the main source of truth for metrics and structured logs.
- **Traces** are sent over HTTP to the OTel Collector (port 4318).
- **Prometheus** pulls numbers from `/metrics` every 15 seconds.
- **Grafana** draws charts from Prometheus (and is ready for Loki logs).
- The **web** app participates in tracing in dev/preview (and injects trace headers when it calls the API from the server).

---

## Where the code lives

### API (`apps/api`)

| Piece | File / path |
|-------|-------------|
| Trace bootstrap (loads before Nest) | `src/tracing.ts` |
| Structured logging | `src/common/logger/pino-logger.config.ts` |
| HTTP metrics interceptor | `src/common/interceptors/http-metrics.interceptor.ts` |
| Metric definitions | `src/common/metrics/metrics.providers.ts`, `metrics.constants.ts` |
| DB pool gauge | `src/common/metrics/typeorm-pool.metrics.ts` |
| Health endpoints | `src/modules/health/health.controller.ts` |
| Redis health indicator | `src/modules/health/redis.health-indicator.ts` |
| Wire-up | `src/app.module.ts`, `src/main.ts` |

### Web (`apps/web`)

| Piece | File / path |
|-------|-------------|
| Trace bootstrap (Node dev/preview) | `src/instrumentation.mjs` |
| Propagate trace to API | `src/utils/trace-headers.ts` (used by `api-client.ts`) |

### Infrastructure (`docker/`)

| Piece | Path |
|-------|------|
| Compose (all services) | `docker/docker-compose.yml` |
| OTel Collector config | `docker/otel-collector/otel-collector-config.yml` |
| Prometheus scrape config | `docker/prometheus/prometheus.yml` |
| Loki config | `docker/loki/loki-config.yml` |
| Grafana datasources | `docker/grafana/provisioning/datasources/datasources.yml` |
| Grafana dashboards | `docker/grafana/dashboards/*.json` |

---

## Important URLs (note: not under `/api`)

Observability endpoints are **excluded** from the global `/api` prefix so Prometheus and Kubernetes-style probes can hit them at fixed paths:

| Endpoint | Full URL | Purpose |
|----------|----------|---------|
| Metrics | `http://localhost:3001/metrics` | Prometheus scrape target |
| Liveness | `http://localhost:3001/health/liveness` | “Is the process alive?” |
| Readiness | `http://localhost:3001/health/readiness` | “Can we serve traffic?” (DB + Redis + memory) |

Business API routes stay under `http://localhost:3001/api/...`.

Health and metrics traffic is **not** logged (Pino ignore) and **not** traced (OTel HTTP ignore hooks) to avoid noise.

---

## How tracing boots before the app

Node must load OpenTelemetry **before** other modules. PCMS does that with `node --import`:

**API** (`apps/api/package.json`):

```text
start:dev  → node --import ./dist/tracing.js  (via nest --exec)
start:prod → node --import ./dist/tracing.js ./dist/main.js
```

**API Docker** (`docker/Dockerfile.api`):

```text
CMD ["node", "--import", "./dist/tracing.js", "./dist/main.js"]
```

**Web dev/preview** (`apps/web/package.json`):

```text
NODE_OPTIONS='--import ./src/instrumentation.mjs' astro dev
```

If tracing is not imported first, auto-instrumentation may miss early HTTP calls.

---

## CORS and trace headers

The API allows browsers to send W3C trace context headers:

```text
traceparent
tracestate
```

Configured in `apps/api/src/main.ts` `allowedHeaders`. This matters if you ever propagate traces from the browser; server-side `apiFetch` already injects propagation headers when running on Node (not in the browser).

---

## Next steps

- Traces in detail: [02 — Distributed tracing](./02-tracing.md)
- Logs: [03 — Logging](./03-logging.md)
- Metrics: [04 — Metrics](./04-metrics.md)
