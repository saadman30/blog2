# 04 — Metrics (Prometheus)

## What are metrics?

**Metrics** are numbers over time: request count, error rate, latency histograms, memory usage, DB pool size.

PCMS exposes them at:

```text
GET http://localhost:3001/metrics
```

This path is **outside** `/api` so Prometheus can scrape without JWT auth.

---

## How Prometheus gets metrics

File: `docker/prometheus/prometheus.yml`

```yaml
scrape_configs:
  - job_name: pcms-api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3001']
```

- Scrape every **15 seconds**
- In Docker, hostname `api` is the API container
- UI: http://localhost:9090

---

## Libraries used

| Library | Role |
|---------|------|
| `@willsoto/nestjs-prometheus` | Registers `/metrics` route and Nest providers |
| `prom-client` | Underlying Prometheus client |

Registered in `AppModule`:

```typescript
PrometheusModule.register({
  path: '/metrics',
  defaultMetrics: { enabled: true },
}),
```

`defaultMetrics: true` adds standard Node/process metrics, including:

- `process_resident_memory_bytes` (RSS)
- `nodejs_heap_size_used_bytes`
- `nodejs_heap_size_total_bytes`
- Event loop / GC metrics (depending on prom-client version)

---

## Custom application metrics

Defined in `apps/api/src/common/metrics/metrics.constants.ts` and `metrics.providers.ts`.

### HTTP metrics (via `HttpMetricsInterceptor`)

Global interceptor registered in `AppModule` as `APP_INTERCEPTOR`.

For every HTTP request it records:

| Metric name | Type | Labels | Meaning |
|-------------|------|--------|---------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | How long the handler took |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total requests |
| `http_request_errors_total` | Counter | `method`, `route`, `status_code` | Errors (thrown exceptions **or** status ≥ 400) |

**Route label:** prefers Express `request.route.path` (template like `/posts/:id`) over raw `request.path` so you do not get one time series per UUID.

**Duration:** measured with `process.hrtime.bigint()` for sub-millisecond accuracy, converted to seconds for Prometheus.

**Histogram buckets:** `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` seconds.

Example PromQL used in Grafana:

```promql
sum(rate(http_requests_total[5m]))
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
100 * sum(rate(http_request_errors_total[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1e-9)
```

### TypeORM connection pool

Provider: `TypeOrmPoolMetrics` (`typeorm-pool.metrics.ts`)

| Metric name | Type | Labels | Meaning |
|-------------|------|--------|---------|
| `typeorm_pool_connections` | Gauge | `state` | Pool size by state |

`state` values:

- `total` — `pool.totalCount`
- `idle` — `pool.idleCount`
- `waiting` — `pool.waitingCount`

Collected on module init and every **15 seconds** until shutdown.

Reads the underlying `pg` pool via `dataSource.driver.master`.

---

## Metrics referenced in dashboards but NOT in code yet

Grafana dashboard **PCMS Overview** also queries these names:

| Metric | Panel | Status |
|--------|-------|--------|
| `redis_cache_hits_total` / `redis_cache_misses_total` | Redis cache hit ratio | **Not implemented** in API code |
| `scheduled_posts_executed_total` | Scheduled posts executed | **Not implemented** |
| `claps_rate_limit_blocks_total` | Claps rate limit blocks | **Not implemented** |

Those panels will show **no data** until you add counters in the relevant services (scheduler consumer, analytics, cache layer). See [07 — Gaps](./07-gaps-and-runbook.md).

---

## Relationship to tracing

| | Metrics | Traces |
|---|---------|--------|
| Granularity | Aggregated over time | Single request |
| Storage | Prometheus TSDB | OTel Collector (logging exporter today) |
| PCMS implementation | `HttpMetricsInterceptor` + prom-client | OTel auto-instrumentation |

Both run on the same requests. A spike in `http_request_duration_seconds` p99 is your hint to find example `trace_id`s in logs.

---

## Security note

`/metrics` is **public** (no JWT). For production:

- Do not expose port 3001 metrics to the internet without auth or network policy
- Common pattern: Prometheus scrapes on an internal Docker/K8s network only
- Or put nginx in front with IP allowlist

---

## Manual checks

```bash
# Raw Prometheus text format
curl -s http://localhost:3001/metrics | head -40

# Only HTTP metrics
curl -s http://localhost:3001/metrics | grep http_request

# Pool gauge
curl -s http://localhost:3001/metrics | grep typeorm_pool
```

---

## Next

- [05 — Health checks](./05-health-checks.md)
- [06 — Docker stack & Grafana](./06-docker-stack-and-grafana.md)
