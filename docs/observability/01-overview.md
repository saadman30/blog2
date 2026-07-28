# 01 - Observability Overview

Observability means: **the app can explain itself while it is running.**

Without observability, debugging often looks like this:

```text
Something broke
  -> add console.log
  -> redeploy
  -> wait
  -> still confused
```

With observability, the app already gives you clues:

```text
Logs tell you what happened.
Metrics tell you how often, how slow, or how broken.
Traces tell you where one request went.
```

## The Three Pieces

PCMS uses the usual three observability pieces:

| Piece | Beginner meaning | Tool in this repo |
|---|---|---|
| Logs | Diary entries from the app | Pino |
| Metrics | Numbers over time | Prometheus |
| Traces | One request's journey | OpenTelemetry |

Short version:

```text
Logs    = individual messages
Metrics = charts and counters
Traces  = request timelines
```

## Big Picture

When the app runs in Docker, the flow looks like this:

```text
Browser
  -> Web app
  -> API
  -> Database / Redis

API
  -> writes JSON logs to stdout
  -> exposes metrics at /metrics
  -> sends traces to OpenTelemetry Collector

Prometheus
  -> pulls metrics from API /metrics

Grafana
  -> shows dashboards from Prometheus
  -> is prepared to show Loki logs later
```

More detailed picture:

```text
Browser
  -> Web (:4321)
  -> API (:3001)
       -> Pino logs on stdout
       -> /metrics endpoint
       -> OpenTelemetry traces

Prometheus (:9090)
  -> scrapes API /metrics every 15 seconds

OpenTelemetry Collector (:4318)
  -> receives traces
  -> prints them to collector logs today

Loki (:3100)
  -> running, but API logs are not shipped there yet

Grafana (:3000)
  -> reads Prometheus
  -> has dashboards for PCMS
```

## What Each Tool Does

### Pino

Pino is the logger.

It writes JSON log lines from the API. A log line might say:

```text
GET /api/posts finished with status 200
```

The useful part is that logs can include:

```text
trace_id
span_id
```

Those IDs help connect a log line to a trace.

### Prometheus

Prometheus is the metrics collector.

It does not wait for the API to push data. Instead, it repeatedly asks:

```text
GET http://api:3001/metrics
```

That is called scraping.

Prometheus stores numbers such as:

```text
How many requests happened?
How many failed?
How long did they take?
How much memory is Node using?
How busy is the database connection pool?
```

### OpenTelemetry

OpenTelemetry creates traces.

A trace is one request's story:

```text
Trace abc123
  -> GET /api/posts
  -> Nest handler
  -> database query
  -> response
```

Each step inside a trace is called a span.

### OpenTelemetry Collector

The Collector receives traces from the API.

Today, it only prints those traces to its own Docker logs. It does not store them in a trace UI such as Tempo or Jaeger yet.

### Loki

Loki is a log database from Grafana.

In this repo, Loki is running and Grafana is configured for it, but the API logs are not automatically shipped into Loki yet.

So empty Grafana log panels are expected until a log shipper is added.

### Grafana

Grafana is the dashboard UI.

It reads from Prometheus and shows charts like:

```text
Request rate
Latency p95/p99
Error rate
Node memory
Database pool usage
```

## Important URLs

These routes are intentionally **not** under `/api`:

| URL | Meaning |
|---|---|
| `http://localhost:3001/metrics` | Raw metrics for Prometheus |
| `http://localhost:3001/health/liveness` | Is the API process alive? |
| `http://localhost:3001/health/readiness` | Can the API serve real traffic? |

Business routes still use `/api`, for example:

```text
http://localhost:3001/api/posts
```

Health and metrics routes are skipped by logging and tracing. They are called often by tools, so including them would create noise.

## Where The Code Lives

API:

| Purpose | Path |
|---|---|
| Trace setup | `apps/api/src/tracing.ts` |
| Logger config | `apps/api/src/common/logger/pino-logger.config.ts` |
| HTTP metrics | `apps/api/src/common/interceptors/http-metrics.interceptor.ts` |
| Metric definitions | `apps/api/src/common/metrics/metrics.providers.ts` |
| DB pool metric | `apps/api/src/common/metrics/typeorm-pool.metrics.ts` |
| Health checks | `apps/api/src/modules/health/infrastructure/http/health.controller.ts` |

Web:

| Purpose | Path |
|---|---|
| Web tracing in dev/preview | `apps/web/src/instrumentation.mjs` |
| Trace headers for server-side API calls | `apps/web/src/utils/trace-headers.ts` |

Infrastructure:

| Purpose | Path |
|---|---|
| Docker services | `docker/docker-compose.yml` |
| Collector config | `docker/otel-collector/otel-collector-config.yml` |
| Prometheus config | `docker/prometheus/prometheus.yml` |
| Loki config | `docker/loki/loki-config.yml` |
| Grafana datasources | `docker/grafana/provisioning/datasources/datasources.yml` |
| Grafana dashboards | `docker/grafana/dashboards/*.json` |

## The Most Important Mental Model

For a normal API request:

```text
1. Request hits the API.
2. OpenTelemetry starts or continues a trace.
3. Nest handles the request.
4. Pino logs the request and includes trace_id/span_id.
5. The metrics interceptor records count, duration, and errors.
6. The trace is sent to the OpenTelemetry Collector.
7. Prometheus later scrapes /metrics.
8. Grafana shows the Prometheus numbers.
```

So when debugging:

```text
Metrics tell you there is a problem.
Logs tell you what the app said.
Traces tell you where one request went.
```

## Next

- [02 - Tracing](./02-tracing.md)
- [03 - Logging](./03-logging.md)
- [04 - Metrics](./04-metrics.md)
