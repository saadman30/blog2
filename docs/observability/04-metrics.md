# 04 - Metrics

Metrics answer this question:

```text
How many? How fast? How often? How broken?
```

Metrics are numbers over time.

Examples:

```text
Requests per second
Error percentage
Average or p95 latency
Memory usage
Database connection pool size
```

## Metrics vs Logs vs Traces

Beginner mental model:

```text
Metrics = charts and counters
Logs    = individual messages
Traces  = one request's path
```

If users say "the site feels slow", metrics help you confirm:

```text
Is latency actually high?
When did it start?
Is every route slow or only one route?
Are errors increasing too?
```

## Where Metrics Live

The API exposes metrics at:

```text
GET http://localhost:3001/metrics
```

This is not under `/api`.

That is intentional. Prometheus needs a simple unauthenticated endpoint to scrape inside the Docker network.

## How Prometheus Gets Metrics

Prometheus does not receive metrics automatically.

It repeatedly asks the API for them:

```text
Prometheus -> GET http://api:3001/metrics
```

That repeated pull is called scraping.

Config file:

```text
docker/prometheus/prometheus.yml
```

The important scrape config:

```yaml
scrape_configs:
  - job_name: pcms-api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3001']
```

In Docker, `api` means the API container.

Prometheus scrapes every 15 seconds.

## Libraries Used

The API uses:

| Library | Purpose |
|---|---|
| `@willsoto/nestjs-prometheus` | Connects Prometheus metrics to Nest |
| `prom-client` | The underlying metrics client |

Registered in:

```text
apps/api/src/app.module.ts
```

## Default Metrics

The app enables default Node.js/process metrics.

These include things like:

```text
process memory
Node heap used
Node heap total
event loop / GC metrics depending on prom-client version
```

Useful examples:

```text
process_resident_memory_bytes
nodejs_heap_size_used_bytes
nodejs_heap_size_total_bytes
```

## Custom HTTP Metrics

HTTP metrics are recorded by:

```text
apps/api/src/common/interceptors/http-metrics.interceptor.ts
```

The interceptor wraps every request and records:

| Metric | Type | Beginner meaning |
|---|---|---|
| `http_requests_total` | Counter | How many requests happened |
| `http_request_errors_total` | Counter | How many requests failed |
| `http_request_duration_seconds` | Histogram | How long requests took |

Each metric has labels:

```text
method
route
status_code
```

Example labels:

```text
method="GET"
route="/posts"
status_code="200"
```

## Counter vs Histogram vs Gauge

Prometheus uses different metric types.

| Type | Simple meaning | Example |
|---|---|---|
| Counter | A number that only goes up | Total requests |
| Histogram | A timing distribution | Request duration |
| Gauge | A number that can go up or down | Current DB pool size |

In PCMS:

```text
http_requests_total          = counter
http_request_errors_total    = counter
http_request_duration_seconds = histogram
typeorm_pool_connections     = gauge
```

## Why The Route Label Uses Templates

The metrics code tries to use route templates instead of raw paths.

Good:

```text
/posts/:id
```

Bad:

```text
/posts/abc123
/posts/def456
/posts/ghi789
```

Why?

If every ID becomes a separate metric series, Prometheus gets noisy and expensive.

This is called avoiding high-cardinality labels.

## Latency Buckets

The duration metric is a histogram.

It groups request times into buckets:

```text
0.005s
0.01s
0.025s
0.05s
0.1s
0.25s
0.5s
1s
2.5s
5s
10s
```

Grafana can use these buckets to show p95 or p99 latency.

Beginner translation:

```text
p95 latency = 95% of requests were faster than this number.
p99 latency = 99% of requests were faster than this number.
```

## Database Pool Metric

The DB pool metric is recorded by:

```text
apps/api/src/common/metrics/typeorm-pool.metrics.ts
```

Metric:

```text
typeorm_pool_connections
```

Labels:

```text
state="total"
state="idle"
state="waiting"
```

Meaning:

| State | Meaning |
|---|---|
| `total` | Total Postgres connections in the pool |
| `idle` | Connections available for use |
| `waiting` | Requests waiting for a connection |

If `waiting` is often above zero, the API may be waiting for database connections.

## Example PromQL

Total request rate:

```promql
sum(rate(http_requests_total[5m]))
```

p95 latency:

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

Error rate percentage:

```promql
100 * sum(rate(http_request_errors_total[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1e-9)
```

Do not worry if PromQL feels weird at first. The main idea is:

```text
PromQL asks Prometheus questions about numbers over time.
```

## Future Metrics Not Implemented Yet

These names are documented as future ideas, but they are not registered in API code today:

| Metric | Intended meaning |
|---|---|
| `redis_cache_hits_total` | Cache hit count |
| `redis_cache_misses_total` | Cache miss count |
| `scheduled_posts_executed_total` | Scheduled posts published |
| `claps_rate_limit_blocks_total` | Clap requests blocked by rate limiting |

Do not add Grafana panels for these until the code actually emits them.

## Security Note

`/metrics` is public inside this app.

That is okay for local Docker/internal networks.

For production:

```text
Do not expose /metrics directly to the public internet.
```

Use network policy, an internal Prometheus, an allowlist, or authentication in front of it.

## Manual Checks

View raw metrics:

```bash
curl -s http://localhost:3001/metrics | head -40
```

Only HTTP metrics:

```bash
curl -s http://localhost:3001/metrics | grep http_request
```

Only DB pool metrics:

```bash
curl -s http://localhost:3001/metrics | grep typeorm_pool
```

Generate traffic:

```bash
for i in $(seq 1 20); do curl -s http://localhost:3001/api/posts > /dev/null; done
```

## Remember

Metrics are best for patterns:

```text
Is it slow?
Is it getting slower?
Are errors increasing?
Did this start after a deploy?
```

Metrics do not tell the full story of one request. Use traces and logs for that.

## Next

- [05 - Health Checks](./05-health-checks.md)
- [06 - Docker and Grafana](./06-docker-stack-and-grafana.md)
