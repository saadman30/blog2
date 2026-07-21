# Observability tutorial — how PCMS watches itself

This guide teaches **observability through the PCMS codebase**. By the end you should be able to:

1. Explain the three pillars (logs, metrics, traces) and how PCMS wires each one
2. Start the Docker observability stack and open Grafana / Prometheus
3. Follow one API request from Nest handler → Pino log → Prometheus counter → OTel span
4. Read the key source files and predict what happens when you hit `/api/posts`
5. Know what is **fully wired** vs **prepared but incomplete** (Loki shipping, Tempo UI, web prod tracing)

If you only need a reference map, use the numbered docs [01 → 07](./README.md). This file is the **tutorial path**.

**Assumptions:**

- Node ≥ 20, Docker Desktop (or Compose) available
- Root `.env` exists (copy from `.env.example` if needed)
- You are OK waiting ~15–30s after traffic for Prometheus scrapes to show in Grafana

---

## 1. Mental model — three questions, three tools

Observability means you can answer questions about a running system **from the outside**, without redeploying a `console.log`.

| Question | Pillar | Tool in PCMS | Where you look |
|----------|--------|--------------|----------------|
| What happened on this request? | **Logs** | Pino → stdout (JSON) | Terminal / `docker logs api` |
| How busy / how slow / how error-prone? | **Metrics** | Prometheus text at `/metrics` | http://localhost:9090 or Grafana |
| Which steps did *this* request take? | **Traces** | OpenTelemetry → OTLP → Collector | `docker logs otel-collector` today |

They are linked on purpose:

```text
  Slow p95 in Grafana
        │
        ▼
  Find a recent log line with the same route
        │
        ▼
  Copy its trace_id
        │
        ▼
  Match that ID in collector span output (or Tempo later)
```

PCMS injects `trace_id` / `span_id` into every Pino HTTP log when an OpenTelemetry span is active. Metrics are separate numbers (aggregates), but they describe the **same** traffic.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  Browser / curl                                                            │
│       │                                                                    │
│       ▼                                                                    │
│  Web :4321 ──(optional)──► API :3001                                       │
│       │  OTEL (dev/preview)     │                                          │
│       │                         ├── Pino JSON → stdout                     │
│       │                         ├── HttpMetricsInterceptor → /metrics      │
│       │                         └── OTel spans → Collector :4318           │
│       │                                      │                             │
│       └──────────────┬───────────────────────┘                             │
│                      ▼                                                     │
│              OTel Collector (prints traces)                                │
│                                                                            │
│  Prometheus :9090 ──scrapes──► GET api:3001/metrics every 15s              │
│  Loki :3100         (ready; logs not shipped yet — see §10)                │
│  Grafana :3000      queries Prometheus (+ Loki when populated)             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bring the stack up

### Option A — full Compose (recommended for this tutorial)

From the **repo root**:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Eight services start: `postgres`, `redis`, `api`, `web`, `otel-collector`, `prometheus`, `loki`, `grafana`.

### Option B — API locally + observability in Docker

```bash
# Terminal 1 — DB / cache / collector / Prometheus / Grafana
docker compose -f docker/docker-compose.yml up -d postgres redis otel-collector prometheus loki grafana

# Terminal 2 — API (uses .env; OTEL points at localhost:4318)
npm run dev:api
```

If Prometheus still scrapes `api:3001` (Docker hostname), local-API-only scrapes will fail until you change `docker/prometheus/prometheus.yml` to `host.docker.internal:3001` (or run the API in Compose too). For metrics without Prometheus, just `curl` `/metrics` on the host.

### Bookmark these URLs

| Tool | URL | Login |
|------|-----|-------|
| Grafana | http://localhost:3000 | `admin` / `admin` |
| Prometheus | http://localhost:9090 | — |
| API metrics | http://localhost:3001/metrics | — |
| API liveness | http://localhost:3001/health/liveness | — |
| API readiness | http://localhost:3001/health/readiness | — |
| Web | http://localhost:4321 | — |

Env vars (root `.env.example`):

```bash
OTEL_SERVICE_NAME=pcms-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

In Compose, the API uses `http://otel-collector:4318/v1/traces` and `OTEL_SERVICE_NAME=pcms-api`.

---

## 3. Hands-on lab — follow one request through all three pillars

Do this once before reading code. It builds the intuition the rest of the tutorial assumes.

### Step 1 — Confirm the API is ready

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

Expect `"status": "ok"` with `database`, `redis`, and `memory_heap` up. If not, fix Postgres/Redis first ([§10 runbook](#10-honesty-map--quick-runbook)).

### Step 2 — Generate real traffic

Health and metrics paths are **ignored** by Pino access logs and OTel HTTP instrumentation (noise control). Use a business route:

```bash
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/posts
done
```

### Step 3 — Logs (what happened)

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -3
```

Or, if you run `npm run dev:api`, look at the Nest terminal: JSON lines with `req`, `res`, `trace_id`, `span_id`.

Pick one `trace_id` and keep it for Step 5.

### Step 4 — Metrics (how busy)

```bash
curl -s http://localhost:3001/metrics | grep 'http_requests_total{'
```

You should see counters labeled with `method`, `route`, `status_code`. After the loop, totals for `GET` + your posts route should be higher.

Open Prometheus → **Graph** → paste:

```promql
sum(rate(http_requests_total[5m]))
```

Or open Grafana → **Dashboards → PCMS → PCMS Overview**. Wait one or two scrape intervals (~15–30s) for charts to move.

### Step 5 — Traces (which steps)

```bash
docker compose -f docker/docker-compose.yml logs otel-collector 2>&1 | tail -40
```

You should see span batches for the API service. Today the collector uses a **logging** exporter only — traces print here, not in a Grafana Tempo UI yet.

**Success check for this lab:** you saw a JSON log with `trace_id`, an increasing Prometheus counter, and collector output after the same traffic.

---

## 4. Where the code lives (map first, then dig)

### API (`apps/api`)

| Piece | Path |
|-------|------|
| Trace bootstrap (before Nest) | `src/tracing.ts` |
| Nest entry + `/api` exclusions | `src/main.ts` |
| Wire-up (Pino, Prometheus, interceptor, pool gauge) | `src/app.module.ts` |
| Pino config + `trace_id` mixin | `src/common/logger/pino-logger.config.ts` |
| HTTP metrics interceptor | `src/common/interceptors/http-metrics.interceptor.ts` |
| Metric names / providers | `src/common/metrics/metrics.constants.ts`, `metrics.providers.ts` |
| DB pool gauge | `src/common/metrics/typeorm-pool.metrics.ts` |
| Health probes | `src/modules/health/infrastructure/http/health.controller.ts` |

### Web (`apps/web`)

| Piece | Path |
|-------|------|
| Trace bootstrap (Node) | `src/instrumentation.mjs` |
| Inject `traceparent` on server fetches | `src/utils/trace-headers.ts` (used by `api-client.ts`) |

### Infrastructure (`docker/`)

| Piece | Path |
|-------|------|
| Full stack | `docker/docker-compose.yml` |
| Collector | `docker/otel-collector/otel-collector-config.yml` |
| Prometheus scrape | `docker/prometheus/prometheus.yml` |
| Grafana datasources / dashboards | `docker/grafana/provisioning/`, `docker/grafana/dashboards/` |

**Important URL rule:** metrics and health are **outside** the global `/api` prefix so scrapers and probes use fixed paths:

```20:26:apps/api/src/main.ts
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'health/liveness', method: RequestMethod.GET },
      { path: 'health/readiness', method: RequestMethod.GET },
    ],
  });
```

Business routes stay under `/api/...`. Observability endpoints stay at `/metrics` and `/health/...`.

---

## 5. Tutorial: tracing — load OTel before Nest

### Why `--import` matters

OpenTelemetry auto-instrumentation must patch libraries **before** they load. PCMS does that with Node’s `--import` hook:

| Script | How tracing starts |
|--------|--------------------|
| API `start:dev` | `nest start --watch --exec "node --import ./dist/tracing.js"` |
| API `start:prod` / Docker | `node --import ./dist/tracing.js ./dist/main.js` |
| Web `dev` / `preview` | `NODE_OPTIONS='--import ./src/instrumentation.mjs' astro …` |

If you ever start the API as plain `node dist/main.js` without `--import`, HTTP spans may be missing.

### What `tracing.ts` does

```1:35:apps/api/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
// ...
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'pcms-api',
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (request) =>
          ignoredPath(request.url ?? ''),
        // ...
      },
    }),
  ],
});

sdk.start();
```

In plain English:

1. Name this process `pcms-api` (or whatever `OTEL_SERVICE_NAME` says).
2. Export spans over HTTP OTLP to the Collector.
3. Auto-instrument HTTP/Express (and other libs in the bundle); **turn off** noisy `fs`.
4. **Skip** URLs containing `/health` or `/metrics`.
5. On `SIGTERM`, flush pending spans.

### Web side (dev/preview only)

`apps/web/src/instrumentation.mjs` is the same idea with default name `pcms-web`. It runs when you use `npm run dev:web` / preview — **not** during `astro build`, and **not** in the production Docker `serve` image today.

When the **Node** side of the web app calls the API, it continues the same distributed trace:

```3:15:apps/web/src/utils/trace-headers.ts
export function injectTraceHeaders(headers: Headers): Headers {
  if (typeof window !== 'undefined') {
    return headers;
  }

  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  // ... sets traceparent / tracestate
}
```

`apiFetch` always calls this. In the **browser** (React islands like `ClapButton`) it is a no-op — client clicks do not continue server traces yet.

The API allows those headers through CORS (`traceparent`, `tracestate` in `main.ts`) in case you add browser propagation later.

### Collector today

```yaml
# docker/otel-collector/otel-collector-config.yml (concept)
receivers: otlp on :4317 (gRPC) and :4318 (HTTP)
exporters: logging (print to collector stdout)
pipeline: traces → receivers → logging
```

So: apps **send** real OTLP; you **inspect** traces with `docker compose … logs -f otel-collector`. A Tempo/Jaeger UI is a future step ([§10](#10-honesty-map--quick-runbook)).

### Exercise

1. Hit `/api/posts` once.
2. Hit `/health/liveness` once.
3. Confirm only the posts request appears as a useful access log / span path (health is ignored by OTel HTTP hooks).

---

## 6. Tutorial: logging — Pino + Nest + trace IDs

### Wire-up

`AppModule` registers `LoggerModule.forRootAsync` with `createPinoLoggerConfig`. `main.ts` uses `bufferLogs: true` and `app.useLogger(app.get(Logger))` so Nest’s `Logger` goes through Pino.

### Config that matters

```11:34:apps/api/src/common/logger/pino-logger.config.ts
export function createPinoLoggerConfig(configService: ConfigService): Params {
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';

  return {
    pinoHttp: {
      level: nodeEnv === 'production' ? 'info' : 'debug',
      mixin() {
        const span = trace.getSpan(context.active());
        if (!span) {
          return {};
        }

        const { traceId, spanId } = span.spanContext();
        return {
          trace_id: traceId,
          span_id: spanId,
        };
      },
      autoLogging: {
        ignore: shouldIgnoreRequest,
      },
    },
  };
}
```

| Behavior | Rule |
|----------|------|
| Level | `info` in production, `debug` otherwise |
| Access log | One JSON line per HTTP request (unless ignored) |
| Correlation | `mixin()` copies active OTel span IDs onto every log |
| Noise | Ignore URLs containing `/health` or `/metrics` |

### Logging from your own code

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Post created');
this.logger.error('Failed to enqueue job', err.stack);
```

Those messages inherit the same Pino pipeline (and `trace_id` when a span is active).

### Where logs go (today)

| How you run | Destination |
|-------------|-------------|
| `npm run dev:api` | Your terminal |
| Docker `api` | `docker compose … logs -f api` |
| Grafana Loki panels | **Empty until a shipper exists** (Promtail / Alloy / OTEL logs) |

Loki itself runs and Grafana is provisioned with a Loki datasource that can extract `trace_id` from JSON — the missing piece is **getting stdout into Loki**.

### Exercise

```bash
# Pretty-print a recent API log line
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep '"msg"' | tail -1 | jq .
```

Confirm `trace_id` and `span_id` exist on a `/api/posts` request, and that hammering `/metrics` does **not** flood access logs.

---

## 7. Tutorial: metrics — Prometheus from Nest

### Exposing `/metrics`

```55:59:apps/api/src/app.module.ts
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
```

`defaultMetrics: true` adds Node process metrics (heap, RSS, event loop, etc.). Custom metrics are registered via `httpMetricsProviders` and collected by:

1. **`HttpMetricsInterceptor`** (global `APP_INTERCEPTOR`) — every Nest HTTP call
2. **`TypeOrmPoolMetrics`** — gauges every 15s from the `pg` pool

### Custom HTTP metrics

| Name | Type | Labels | Meaning |
|------|------|--------|---------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latency |
| `http_requests_total` | Counter | same | Volume |
| `http_request_errors_total` | Counter | same | Thrown errors **or** status ≥ 400 |

The interceptor:

1. Starts `process.hrtime.bigint()`
2. Resolves **route template** (`request.route.path` like `/posts/:id`) so UUIDs do not explode cardinality
3. On success or error, observes duration and increments counters

Prometheus scrapes (Docker):

```yaml
# docker/prometheus/prometheus.yml
scrape_interval: 15s
job: pcms-api → api:3001/metrics
```

### Pool gauge

`typeorm_pool_connections{state="total|idle|waiting"}` — useful when the API feels “stuck” waiting on Postgres connections.

### Useful PromQL (same queries Grafana uses)

```promql
sum(rate(http_requests_total[5m]))

histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

100 * sum(rate(http_request_errors_total[5m]))
  / clamp_min(sum(rate(http_requests_total[5m])), 1e-9)
```

### Security note

`/metrics` is **unauthenticated**. Fine on an internal Docker network; do not expose it on the public internet without network policy or auth.

### Exercise

```bash
curl -s http://localhost:3001/metrics | grep http_request_duration_seconds
curl -s http://localhost:3001/metrics | grep typeorm_pool_connections
```

Generate 30 requests again, re-curl, and confirm counters moved. In Prometheus **Status → Targets**, `pcms-api` should be **UP**.

---

## 8. Tutorial: health checks — liveness vs readiness

Platforms need two answers:

| Probe | URL | Meaning in PCMS |
|-------|-----|-----------------|
| **Liveness** | `GET /health/liveness` | Process alive; heap under 300 MB |
| **Readiness** | `GET /health/readiness` | Can serve work: Postgres ping + Redis ping + heap |

Controller: `apps/api/src/modules/health/infrastructure/http/health.controller.ts` (`@Public()`, Terminus `@HealthCheck()`).

```bash
curl -s http://localhost:3001/health/liveness | jq .
curl -s http://localhost:3001/health/readiness | jq .
```

Failed checks return **503** with which indicator failed.

These routes are excluded from `/api`, skipped by Pino access logs, and skipped by OTel HTTP ignore hooks — probes should not drown signal.

**Compose gap:** Postgres/Redis have healthchecks; the `api` service does not yet. `web` may start before the API is ready. Prefer curling readiness before demos.

---

## 9. Tutorial: Grafana — read the dashboards

1. Open http://localhost:3000 → login `admin` / `admin`
2. **Dashboards → PCMS** folder (provisioned automatically)

| Dashboard | What it shows |
|-----------|----------------|
| **PCMS Overview** | RPS, latency p95/p99, error %, pool, heap/RSS, log panel (Loki) |
| **PCMS API Observability** | Focused API metrics + “logs with `trace_id`” Loki query |

Datasources are provisioned in `docker/grafana/provisioning/datasources/datasources.yml`:

- **Prometheus** → `http://prometheus:9090` (default)
- **Loki** → `http://loki:3100` + derived field regex on `"trace_id":"(\w+)"`

### Walkthrough after generating traffic

1. Open **PCMS Overview**, time range **Last 15 minutes**, refresh **10s**.
2. Confirm **Request Rate** rises after your `curl` loop.
3. Confirm **Latency** panels have data (histograms need scrapes).
4. Open the logs panel — **expect empty** until log shipping is added (see next section). Use `docker logs` for logs today.
5. Open Prometheus Targets in another tab if a panel is blank — scrape must be UP.

---

## 10. Honesty map & quick runbook

### What works today

| Capability | Status |
|------------|--------|
| Pino JSON + `trace_id` / `span_id` | ✅ API stdout |
| HTTP + Node + TypeORM pool metrics | ✅ `/metrics` |
| OTLP export to Collector | ✅ API; web in **dev/preview** |
| Server-side `apiFetch` trace headers | ✅ |
| Liveness / readiness | ✅ |
| Prometheus scrape + Grafana metric dashboards | ✅ Docker Compose |

### Known gaps (do not oversell)

| Gap | Symptom | Direction |
|-----|---------|-----------|
| No log shipper → Loki | Grafana log panels empty | Add Promtail / Alloy / OTEL logs pipeline |
| Collector `logging` exporter only | No Tempo/Jaeger UI in Grafana | Export to Tempo; add Grafana trace datasource |
| Web Docker uses static `serve` | `OTEL_SERVICE_NAME=pcms-web` unused in prod image | Load instrumentation only if you add a Node SSR server |
| Browser islands skip propagation | Clap/login from client don’t join server traces | Browser OTEL or pass context from SSR |
| Future counters (cache/scheduler/claps) | Not in code or Overview panels | Implement counters, then restore panels |

Full detail: [07 — Gaps & runbook](./07-gaps-and-runbook.md) and [11 — Current gaps](../11-current-gaps.md).

### “Is observability working?” checklist

```bash
# 1. Metrics endpoint
curl -sf http://localhost:3001/metrics | grep -c http_requests_total

# 2. Traffic
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:3001/api/posts; done

# 3. Logs with correlation
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -3

# 4. Traces received
docker compose -f docker/docker-compose.yml logs otel-collector 2>&1 | tail -20

# 5. Prometheus target
# open http://localhost:9090/targets → pcms-api UP

# 6. Grafana
# open http://localhost:3000 → PCMS Overview → RPS > 0
```

### Readiness failing

| Failed check | Action |
|--------------|--------|
| `database` | `docker compose ps postgres`; check `DATABASE_*` env |
| `redis` | `docker compose ps redis`; `redis-cli ping` |
| `memory_heap` | Restart API; investigate leak or raise 300 MB limit |

---

## 11. End-to-end story — one `GET /api/posts`

Put it together:

```text
1. curl hits API :3001/api/posts
2. OTel HTTP instrumentation starts/continues a span (not ignored — not /health|/metrics)
3. Nest routing → Posts controller → service → TypeORM
4. Pino access log writes JSON including trace_id / span_id from active span
5. HttpMetricsInterceptor records duration + http_requests_total{method="GET", ...}
6. Response returns { success, data } via TransformInterceptor
7. Span ends → OTLP HTTP POST → otel-collector → printed to collector logs
8. ~15s later Prometheus scrapes /metrics; Grafana charts update
```

Metrics answer “are posts list calls getting slower?”  
Logs answer “what did we say for this failure?”  
Traces answer “where did that one slow request spend time?”

---

## 12. How to extend (when you change the system)

Keep changes surgical and consistent with existing noise rules:

| Goal | Where to change |
|------|-----------------|
| New HTTP metric | Prefer extending interceptor labels carefully; avoid high-cardinality labels (no raw IDs) |
| Domain counter (e.g. scheduled posts) | `makeCounterProvider` + `inc()` in the service that owns the event; then a Grafana panel |
| More logging | Nest `Logger` in the service; never log tokens/passwords |
| Ship logs to Loki | New Compose service (Promtail/Alloy), keep `{job="pcms-api"}` label dashboards expect |
| Trace UI | Tempo + collector exporter + Grafana datasource |
| New probe | Terminus indicator + readiness list; keep `/health` ignored in Pino/OTel |

---

## Next reading

| Doc | Use when |
|-----|----------|
| [01 — Overview](./01-overview.md) | Architecture diagram + file map |
| [02 — Tracing](./02-tracing.md) | Deeper OTEL / propagation detail |
| [03 — Logging](./03-logging.md) | LogQL examples, Loki config |
| [04 — Metrics](./04-metrics.md) | PromQL + future metric names |
| [05 — Health checks](./05-health-checks.md) | Terminus response shape |
| [06 — Docker & Grafana](./06-docker-stack-and-grafana.md) | Full Compose topology |
| [07 — Gaps & runbook](./07-gaps-and-runbook.md) | Troubleshooting + implementation order |
