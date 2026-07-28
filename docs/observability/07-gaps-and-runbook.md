# 07 - Gaps And Runbook

This page answers two practical questions:

```text
What works today?
What should I check when something looks broken?
```

It is intentionally honest. Some observability pieces are fully working, and some are prepared but not fully connected yet.

## What Works Today

Fully working:

| Capability | Status |
|---|---|
| API JSON logs | Working on stdout |
| `trace_id` / `span_id` in API logs | Working when a span is active |
| HTTP request metrics | Working at `/metrics` |
| Node default metrics | Working at `/metrics` |
| TypeORM DB pool metric | Working every 15 seconds |
| Prometheus scraping API metrics | Working in Docker Compose |
| Grafana metric dashboards | Working |
| API traces sent to OTel Collector | Working |
| Web server traces in dev/preview | Working |
| Server-side web-to-API trace headers | Working |
| Liveness and readiness probes | Working |
| Health/metrics routes skipped by log/trace noise controls | Working |

## What Is Not Fully Wired Yet

Prepared but incomplete:

| Gap | What you will see |
|---|---|
| API logs are not shipped to Loki | Grafana log panels stay empty |
| Traces are not stored in Tempo/Jaeger | No Grafana trace UI yet |
| Web tracing is not loaded in production Docker | Web container OTEL env has little effect |
| Browser-only calls do not propagate traces | Client-side button requests start separate/no traces |
| Some future metrics do not exist yet | Do not add dashboards for them yet |
| API Compose service has no healthcheck | Web may start before API is truly ready |
| `/metrics` is unauthenticated | Must protect it in production |

The most important beginner note:

```text
Empty Grafana log panels are expected right now.
```

That does not mean Prometheus, Grafana, or the API are broken.

## Gap 1: Logs Do Not Reach Loki Yet

Current situation:

```text
API writes logs to stdout.
Loki is running.
Grafana has Loki panels prepared.
No service ships API stdout into Loki.
```

Result:

```text
Grafana log panels are empty.
```

Use this for logs today:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

Possible future fixes:

```text
Add Promtail
Add Grafana Alloy
Add a Docker logging driver
Add an OpenTelemetry logs pipeline
```

## Gap 2: Traces Only Print To Collector Logs

Current situation:

```text
API sends traces to the OpenTelemetry Collector.
Collector receives them.
Collector only uses a logging exporter today.
```

Result:

```text
Traces appear in Collector logs.
They do not appear in a Grafana trace UI yet.
```

View traces today:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

Possible future fixes:

```text
Add Grafana Tempo
or add Jaeger
then configure Collector to export traces there
then add a Grafana trace datasource
```

## Gap 3: Web Production Docker Tracing Is Limited

The web app has tracing for dev/preview.

But the production Docker image serves static files with `serve`.

Result:

```text
OTEL_SERVICE_NAME=pcms-web exists in Docker,
but tracing is not really active for static serving.
```

This is only a problem if you expect production web-server traces.

## Gap 4: Browser Calls Do Not Propagate Traces

The helper:

```text
apps/web/src/utils/trace-headers.ts
```

does nothing when running in the browser.

Result:

```text
Server-side web requests can pass trace headers.
Browser-only React island calls do not.
```

Possible future fixes:

```text
Add browser OpenTelemetry
or pass server trace context into browser code
```

## Gap 5: Future Metrics Are Not Implemented

These metric names are ideas, not current API output:

| Metric | Meaning |
|---|---|
| `redis_cache_hits_total` | Cache hits |
| `redis_cache_misses_total` | Cache misses |
| `scheduled_posts_executed_total` | Scheduled posts published |
| `claps_rate_limit_blocks_total` | Clap requests blocked |

Do not add Grafana panels for these until the API emits them.

## Gap 6: API Has No Compose Healthcheck

Postgres and Redis have Docker healthchecks.

The API service does not currently define one.

Result:

```text
web depends on api service_started,
not api service_healthy.
```

So the web container can start before the API is truly ready.

Future fix:

```text
Add a Compose healthcheck that curls /health/readiness.
```

## Gap 7: `/metrics` Is Public

The metrics endpoint has no JWT protection.

This is okay for local/internal Docker use.

For production:

```text
Do not expose /metrics directly to the public internet.
```

Use an internal network, allowlist, auth proxy, or Kubernetes network policy.

## Runbook: Is Observability Working?

Use this checklist when you are unsure.

### 1. Check API Metrics

```bash
curl -sf http://localhost:3001/metrics | grep -c http_requests_total
```

Expected:

```text
A number is printed.
```

After traffic, counters should increase.

### 2. Check Prometheus Target

Open:

```text
http://localhost:9090/targets
```

Expected:

```text
pcms-api is UP.
```

If it is down, the API may not be running or Prometheus may not be able to reach it.

### 3. Generate Traffic

```bash
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3001/api/posts; done
```

Wait 15-30 seconds because Prometheus scrapes every 15 seconds.

### 4. Check Grafana Metrics

Open:

```text
http://localhost:3000
```

Go to:

```text
Dashboards -> PCMS -> PCMS Overview
```

Expected:

```text
Request rate moves above zero.
Latency panels populate.
```

### 5. Check Logs With Trace IDs

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -5
```

Expected:

```text
API JSON log lines with trace_id.
```

Make sure you hit a real API route, not `/health` or `/metrics`.

### 6. Check Traces At The Collector

```bash
docker compose -f docker/docker-compose.yml logs otel-collector 2>&1 | tail -20
```

Expected:

```text
Span batches after API requests.
```

## Runbook: Readiness Is Failing

Check readiness:

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

Then use the failed key:

| Failed check | What to inspect |
|---|---|
| `database` | Postgres container, `DATABASE_HOST`, TypeORM errors |
| `redis` | Redis container, `REDIS_HOST`, Redis connectivity |
| `memory_heap` | API memory usage, possible leak, memory limit |

Useful commands:

```bash
docker compose -f docker/docker-compose.yml ps postgres
docker compose -f docker/docker-compose.yml ps redis
docker compose -f docker/docker-compose.yml logs api
```

## Runbook: Grafana Log Panels Are Empty

This is expected today.

Confirm Loki itself is running:

```bash
curl -s http://localhost:3100/ready
```

Expected:

```text
ready
```

Then remember:

```text
Loki being ready does not mean API logs are being shipped to Loki.
```

Use API Docker logs instead:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

## Runbook: Local Dev Without Full Docker Stack

You can run only the Collector:

```bash
docker compose -f docker/docker-compose.yml up otel-collector
```

Then run the API with:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces npm run dev:api
```

Metrics are still available at:

```text
http://localhost:3001/metrics
```

Prometheus is optional for local debugging.

## Suggested Implementation Order

If you want to extend observability, do it in this order:

| Order | Work | Why |
|---:|---|---|
| 1 | Add Promtail or Grafana Alloy | Makes Grafana log panels useful |
| 2 | Add Tempo or Jaeger | Makes traces browsable |
| 3 | Add missing application counters | Enables future dashboard panels |
| 4 | Add API Compose healthcheck | Lets services depend on readiness |
| 5 | Improve web/browser tracing | Connects more user interactions |

## Remember

```text
Metrics in Grafana should work today.
Logs in Grafana are prepared but not wired.
Traces reach the Collector but not a trace UI.
```

That one sentence explains most of the current observability stack.
