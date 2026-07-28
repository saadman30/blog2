# Observability Tutorial

This tutorial explains PCMS observability from scratch.

Goal:

```text
Understand what the observability stack does,
how the pieces connect,
and how to check whether it is working.
```

If you are new to observability, start here.

## The One-Minute Version

Observability means:

```text
The app gives us clues about what it is doing while it runs.
```

PCMS uses three kinds of clues:

| Clue | Beginner meaning | Tool |
|---|---|---|
| Logs | Diary entries | Pino |
| Metrics | Numbers and charts | Prometheus |
| Traces | One request's journey | OpenTelemetry |

Remember this:

```text
Logs    = what happened
Metrics = how much / how slow / how many errors
Traces  = where one request went
```

## The Cast Of Characters

When you run the Docker stack, these services matter:

| Service | What it does |
|---|---|
| `api` | Runs the Nest API and emits observability data |
| `web` | Runs the Astro web app |
| `postgres` | Database |
| `redis` | Queue/cache support |
| `prometheus` | Collects metrics from the API |
| `otel-collector` | Receives traces from the API |
| `loki` | Log database, running but not receiving API logs yet |
| `grafana` | Dashboard UI |

Simple picture:

```text
Browser -> Web -> API -> Postgres / Redis

API -> logs
API -> metrics at /metrics
API -> traces to OpenTelemetry Collector

Prometheus -> scrapes /metrics
Grafana -> shows Prometheus dashboards
```

## Start The Stack

Run:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Then open:

| Tool | URL | Notes |
|---|---|---|
| Grafana | http://localhost:3000 | `admin` / `admin` |
| Prometheus | http://localhost:9090 | Metrics UI |
| API metrics | http://localhost:3001/metrics | Raw metrics text |
| Liveness | http://localhost:3001/health/liveness | Is API alive? |
| Readiness | http://localhost:3001/health/readiness | Is API ready? |

## Step 1: Make A Real API Request

Run:

```bash
curl http://localhost:3001/api/posts
```

This request can create:

```text
an API log line
metric counter changes
an OpenTelemetry trace/span
```

Now generate more traffic:

```bash
for i in $(seq 1 20); do curl -s http://localhost:3001/api/posts > /dev/null; done
```

## Step 2: Look At Logs

Logs answer:

```text
What did the API say happened?
```

Check API logs:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

Look for JSON lines.

Useful fields:

```text
msg
req
res
trace_id
span_id
```

Find logs with trace IDs:

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -5
```

Why `trace_id` matters:

```text
It lets you connect this log line to a trace for the same request.
```

Important:

```text
Grafana log panels are expected to be empty today.
```

Why?

```text
The API writes logs to stdout,
but no log shipper sends those logs into Loki yet.
```

So use `docker compose logs api` for logs today.

## Step 3: Look At Metrics

Metrics answer:

```text
How many requests?
How many errors?
How slow?
How much memory?
How busy is the DB pool?
```

Open raw metrics:

```bash
curl -s http://localhost:3001/metrics | head -40
```

Find HTTP metrics:

```bash
curl -s http://localhost:3001/metrics | grep http_request
```

Important metrics:

| Metric | Meaning |
|---|---|
| `http_requests_total` | Total API requests |
| `http_request_errors_total` | Failed/error API requests |
| `http_request_duration_seconds` | Request timing histogram |
| `typeorm_pool_connections` | Database connection pool size |

Beginner translation:

```text
http_requests_total tells you traffic volume.
http_request_errors_total tells you failure volume.
http_request_duration_seconds tells you latency.
typeorm_pool_connections tells you database pool pressure.
```

## Step 4: Look At Prometheus

Open:

```text
http://localhost:9090
```

Go to:

```text
Status -> Targets
```

Expected:

```text
pcms-api is UP.
```

If `pcms-api` is down, Prometheus cannot scrape the API.

Try this PromQL query in Prometheus:

```promql
sum(rate(http_requests_total[5m]))
```

That means:

```text
How many requests per second happened recently?
```

## Step 5: Look At Grafana

Open:

```text
http://localhost:3000
```

Login:

```text
admin / admin
```

Go to:

```text
Dashboards -> PCMS
```

Open:

```text
PCMS Overview
```

Expected after traffic:

```text
Request rate panel moves.
Latency panel populates.
Error rate may stay at zero if requests succeed.
Memory and DB pool panels show values.
```

If panels are empty, wait 15-30 seconds.

Why?

```text
Prometheus scrapes every 15 seconds.
Grafana reads from Prometheus.
```

## Step 6: Look At Traces

Traces answer:

```text
Where did one request go?
```

A trace contains spans:

```text
Trace abc123
  Span: HTTP GET /api/posts
  Span: route handler
  Span: database call
```

The API sends traces to the OpenTelemetry Collector.

Check Collector logs:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

Make another API request:

```bash
curl http://localhost:3001/api/posts
```

You should see trace/span output in the Collector logs.

Important:

```text
Traces reach the Collector today.
They are not stored in a Grafana trace UI yet.
```

To get a trace UI later, add Tempo or Jaeger and configure the Collector to export traces there.

## Step 7: Understand Health Checks

Health checks answer:

```text
Is the API alive?
Is the API ready to serve traffic?
```

Check liveness:

```bash
curl -i http://localhost:3001/health/liveness
```

Check readiness:

```bash
curl -i http://localhost:3001/health/readiness
```

Liveness means:

```text
The process is alive and memory is under the heap limit.
```

Readiness means:

```text
The API can reach Postgres.
The API can reach Redis.
Memory is under the heap limit.
```

If readiness fails, the app should not receive real traffic.

## Step 8: Understand What Is Skipped

These routes are skipped by automatic logs and traces:

```text
/health
/metrics
```

Why?

Because tools call them frequently.

If they were logged and traced every time, useful signal would be buried under probe noise.

Business routes are still observed:

```text
/api/posts
/api/auth/login
...
```

## Step 9: Connect Logs, Metrics, And Traces

A practical debugging flow:

```text
1. Grafana shows latency is high.
2. Check API logs around that time.
3. Find a slow/error request log.
4. Copy its trace_id.
5. Look for that trace_id in Collector logs.
6. Use the trace to see where the request spent time.
```

Or:

```text
1. User reports an error.
2. Check logs for the route/status/error.
3. Use trace_id to connect logs to a trace.
4. Use metrics to see whether many users are affected.
```

This is the main value of observability:

```text
It lets you move from "something feels wrong"
to "this part of the system is causing it."
```

## What Works vs What Is Prepared

This distinction is important.

Works today:

```text
API logs on stdout
trace_id/span_id in logs
metrics at /metrics
Prometheus scraping
Grafana metric dashboards
health checks
traces reaching Collector logs
```

Prepared but incomplete:

```text
Loki log storage is running, but logs are not shipped there.
Grafana log panels exist, but are empty until log shipping is added.
Traces reach Collector, but not Tempo/Jaeger/Grafana trace UI.
Production Docker web tracing is limited.
Browser-only calls do not propagate trace context.
```

If you remember only one thing:

```text
Metrics in Grafana should work.
Logs in Grafana are expected to be empty.
Traces are visible in Collector logs, not a trace UI.
```

## Common Problems

### Grafana metric panels are empty

Check Prometheus target:

```text
http://localhost:9090/targets
```

Expected:

```text
pcms-api UP
```

Generate traffic and wait:

```bash
for i in $(seq 1 20); do curl -s http://localhost:3001/api/posts > /dev/null; done
```

### Grafana log panels are empty

Expected today.

Use:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

### Collector has no traces

Check the API has the right endpoint:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
```

Then hit a real API route, not `/health` or `/metrics`:

```bash
curl http://localhost:3001/api/posts
```

### Readiness fails

Check:

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

Then inspect the failed dependency:

| Failed key | Likely issue |
|---|---|
| `database` | Postgres down or wrong DB config |
| `redis` | Redis down or wrong Redis config |
| `memory_heap` | API memory too high |

## Files To Know

API observability:

| Purpose | Path |
|---|---|
| Trace setup | `apps/api/src/tracing.ts` |
| Logger config | `apps/api/src/common/logger/pino-logger.config.ts` |
| HTTP metrics interceptor | `apps/api/src/common/interceptors/http-metrics.interceptor.ts` |
| Metrics providers | `apps/api/src/common/metrics/metrics.providers.ts` |
| DB pool metric | `apps/api/src/common/metrics/typeorm-pool.metrics.ts` |
| Health controller | `apps/api/src/modules/health/infrastructure/http/health.controller.ts` |

Web observability:

| Purpose | Path |
|---|---|
| Web tracing in dev/preview | `apps/web/src/instrumentation.mjs` |
| Trace header injection | `apps/web/src/utils/trace-headers.ts` |

Docker observability:

| Purpose | Path |
|---|---|
| Compose stack | `docker/docker-compose.yml` |
| Collector config | `docker/otel-collector/otel-collector-config.yml` |
| Prometheus config | `docker/prometheus/prometheus.yml` |
| Loki config | `docker/loki/loki-config.yml` |
| Grafana datasources | `docker/grafana/provisioning/datasources/datasources.yml` |
| Grafana dashboards | `docker/grafana/dashboards/*.json` |

## Suggested Next Improvements

If you want to make observability more complete, a good order is:

| Order | Improvement | Result |
|---:|---|---|
| 1 | Add Promtail or Grafana Alloy | Logs appear in Grafana |
| 2 | Add Tempo or Jaeger | Traces become browsable |
| 3 | Add missing app counters | More useful dashboards |
| 4 | Add API Docker healthcheck | Better startup dependency behavior |
| 5 | Add browser tracing | Client interactions join traces |

## Final Mental Model

When one normal API request happens:

```text
1. Request hits API.
2. OpenTelemetry creates/continues a trace.
3. Nest handles the request.
4. Pino writes logs with trace_id/span_id.
5. Metrics interceptor records count, status, and duration.
6. Trace is exported to the Collector.
7. Prometheus scrapes /metrics later.
8. Grafana shows Prometheus charts.
```

Use the tools like this:

```text
Start with metrics when you need the size of the problem.
Use logs when you need exact messages and errors.
Use traces when you need one request's path.
```

That is observability in this repo.
