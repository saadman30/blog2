# 02 — Distributed tracing

## What is a trace?

A **trace** follows one logical operation — for example “user clicked Save on WriteForm” — across services and functions.

- A trace has a **trace ID** (same for the whole journey).
- Inside the trace are **spans** (smaller steps: “HTTP POST /api/posts”, “Postgres query”, etc.).
- Spans can be nested (parent / child).

PCMS uses **OpenTelemetry (OTEL)** to create spans automatically and export them in **OTLP** format over HTTP.

---

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `OTEL_SERVICE_NAME` | `pcms-api` or `pcms-web` | Shows up as the service name in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | Where spans are POSTed |

In Docker Compose, both `api` and `web` point at:

```text
http://otel-collector:4318/v1/traces
```

Config namespace in API: `telemetryConfig` in `apps/api/src/config/configuration.ts` (loaded into ConfigModule; tracing.ts reads env directly at bootstrap).

---

## API tracing (`apps/api/src/tracing.ts`)

### What gets instrumented

Uses `@opentelemetry/sdk-node` with `@opentelemetry/auto-instrumentations-node`:

| Instrumentation | Setting |
|-----------------|---------|
| HTTP (incoming + outgoing) | On, but **ignores** URLs containing `/health` or `/metrics` |
| Express | On |
| File system (`fs`) | **Off** (reduces noise) |
| Other common libs | Via auto-instrumentations bundle (e.g. `pg`, `ioredis` may get spans depending on version) |

### Export path

```text
API process
  → OTLPTraceExporter (HTTP)
  → OTEL_EXPORTER_OTLP_ENDPOINT
  → OpenTelemetry Collector :4318
```

### Shutdown

On `SIGTERM`, `sdk.shutdown()` flushes pending spans (graceful container stop).

### Build note

`tracing.ts` is compiled to `dist/tracing.js` and imported with `--import` **before** `main.js`. It is excluded from Jest coverage (`jest.config.ts`) because it runs at process entry, not as a testable module graph.

---

## Web tracing (`apps/web/src/instrumentation.mjs`)

Loaded only when Node starts with:

```bash
NODE_OPTIONS='--import ./src/instrumentation.mjs'
```

Used in `dev` and `preview` scripts — **not** in `astro build`, and **not** in the production Docker `serve` command today.

Similar setup to API:

- Service name from `OTEL_SERVICE_NAME` (default `pcms-web`)
- OTLP HTTP exporter to same endpoint
- Auto-instrumentations with `fs` disabled, HTTP enabled

**What this traces in practice:** Astro dev server HTTP requests (SSR-ish server work during dev), and outbound HTTP from the Node side.

**What it does not trace:** Pure browser-only React island clicks (unless you add browser OTEL later). Static files served by `serve` in Docker have no Node instrumentation.

---

## Propagating context to the API

When the **web server** (Node) calls the API, it should pass the current trace so the API continues the same trace.

File: `apps/web/src/utils/trace-headers.ts`

```text
injectTraceHeaders(headers)
  → if running in browser (window exists): return headers unchanged
  → else: propagation.inject(context.active(), carrier)
  → sets traceparent / tracestate on the Headers object
```

`apiFetch` in `api-client.ts` calls this before every request.

**Result:** A blog index fetch or login from Astro dev can appear as one distributed trace: web span → API span.

**Browser-only calls** (e.g. `ClapButton` in the client) do not inject server trace headers today.

---

## OpenTelemetry Collector

File: `docker/otel-collector/otel-collector-config.yml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:  :4317
      http:  :4318

exporters:
  logging:
    verbosity: basic

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [logging]
```

**What this means today:**

- Collector **accepts** traces on 4317 (gRPC) and 4318 (HTTP).
- It **prints** them to the collector container logs (`logging` exporter).
- It does **not** forward to Jaeger, Tempo, or Grafana Cloud yet.

To see traces locally:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

Make some API requests; you should see span batches in the collector output.

---

## Linking traces to logs

Pino mixin (`pino-logger.config.ts`) reads the **active span** from OpenTelemetry context and adds:

```json
{
  "trace_id": "...",
  "span_id": "..."
}
```

So a log line and a trace share the same `trace_id` when both exist for that request.

Grafana Loki datasource defines a **derived field** regex on `"trace_id":"(\w+)"` so log lines can link toward trace exploration (once traces are stored in a backend Grafana can query).

---

## Noise control

Both tracing and logging **skip** health and metrics endpoints:

| System | Mechanism |
|--------|-----------|
| OTel HTTP | `ignoreIncomingRequestHook` / `ignoreOutgoingRequestHook` on `/health`, `/metrics` |
| Pino | `autoLogging.ignore` same URL patterns |

This keeps dashboards and trace volume focused on real user traffic.

---

## Mental model

```text
1. Request hits API
2. OTel HTTP instrumentation creates/continues a span
3. Nest handler runs inside that context
4. Pino logs include trace_id / span_id
5. On response, span ends and exports to Collector
6. HttpMetricsInterceptor records Prometheus metrics (separate from OTel, but same request)
```

Metrics and traces are **complementary**: metrics show aggregates; traces show one slow request’s story.

---

## Next

- [03 — Logging](./03-logging.md)
- [07 — Gaps & runbook](./07-gaps-and-runbook.md) (Tempo/Jaeger, web Docker tracing)
