# 07 — Gaps, runbook & troubleshooting

This page is the honest companion to the observability docs: what works out of the box, what is **prepared but incomplete**, and how to debug common issues.

---

## What works today (checklist)

| Capability | Status |
|------------|--------|
| Structured JSON logs with `trace_id` / `span_id` | ✅ API stdout |
| HTTP request metrics (rate, duration, errors) | ✅ `/metrics` |
| Node default metrics (heap, RSS, etc.) | ✅ `/metrics` |
| TypeORM pool gauge | ✅ every 15s |
| OTLP trace export to Collector | ✅ API (+ web in dev/preview) |
| Trace context on server-side `apiFetch` | ✅ `trace-headers.ts` |
| Liveness / readiness probes | ✅ `/health/liveness`, `/health/readiness` |
| Prometheus scraping API | ✅ Docker Compose |
| Grafana dashboards for HTTP + pool metrics | ✅ |
| Health/metrics excluded from log + trace noise | ✅ |

---

## Known gaps

### 1. Logs do not reach Loki automatically

**Situation:** Loki runs in Compose; Grafana panels query `{job="pcms-api"}`. There is **no Promtail**, **no Docker logging driver**, and **no OTEL logs pipeline** shipping API stdout into Loki.

**What you see:** Log panels in Grafana stay empty.

**Workarounds:**

- Use `docker compose logs -f api` for live logs
- Add [Promtail](https://grafana.com/docs/loki/latest/send-data/promtail/) or Grafana Alloy as a Compose service tailing container logs
- Or export logs via OTEL logs exporter → Collector → Loki

### 2. Traces only print to Collector logs

**Situation:** `otel-collector-config.yml` exports traces to `logging` exporter only — not Jaeger, Tempo, or Grafana Tempo datasource.

**What you see:** Traces in `docker logs otel-collector`, not in Grafana trace UI.

**Next step:** Add a `otlp` or `jaeger` exporter pointing at Tempo/Jaeger and add Grafana trace datasource.

### 3. Web tracing not loaded in production Docker

**Situation:** `Dockerfile.web` runs `serve` without `NODE_OPTIONS='--import ./src/instrumentation.mjs'`.

**What you see:** `OTEL_SERVICE_NAME=pcms-web` on the container has no effect for static serving.

**Dev/preview:** Tracing works via `package.json` dev/preview scripts.

### 4. Browser client calls do not propagate traces

**Situation:** `injectTraceHeaders` is a no-op when `window` is defined.

**What you see:** `ClapButton` and other `client:load` islands do not continue server traces.

**Fix direction:** Browser OTEL SDK or pass trace context from SSR props.

### 5. Future application metrics (not in dashboard)

These metric names were considered for **PCMS Overview** but are **not registered in API code** and **panels were removed** from the dashboard until implemented:

| Metric | Intended meaning |
|--------|------------------|
| `redis_cache_hits_total` / `redis_cache_misses_total` | Cache effectiveness |
| `scheduled_posts_executed_total` | BullMQ scheduler published count |
| `claps_rate_limit_blocks_total` | Throttled clap requests |

Add counters in the relevant services before re-adding Grafana panels.

### 6. API Compose service has no healthcheck

Postgres and Redis have healthchecks; `api` does not. `web` depends on `api` with `service_started` only — not readiness.

**Impact:** Web may start before API can serve `/api/posts`.

**Fix direction:** Add Compose `healthcheck` curling `/health/readiness`.

### 7. `/metrics` is unauthenticated

Fine for internal Docker network; **do not** expose publicly without protection.

---

## Runbook: “Is observability working?”

### Step 1 — API metrics

```bash
curl -sf http://localhost:3001/metrics | grep -c http_requests_total
```

Expect a number ≥ 0. After traffic, counters should increase.

### Step 2 — Prometheus target

Open http://localhost:9090/targets — `pcms-api` state **UP**.

### Step 3 — Generate traffic

```bash
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3001/api/posts; done
```

### Step 4 — Grafana graphs

Open http://localhost:3000 → Dashboards → PCMS → **PCMS Overview**.

- Request Rate should move above zero
- Latency panel should populate after a few scrape intervals

### Step 5 — Logs with trace IDs

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -5
```

Hit an API route (not `/health`). You should see JSON with `trace_id`.

### Step 6 — Traces at collector

```bash
docker compose -f docker/docker-compose.yml logs otel-collector 2>&1 | tail -20
```

After API requests, look for exported span batches.

---

## Runbook: readiness failing

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

| Failed check | Action |
|--------------|--------|
| `database` | `docker compose ps postgres`; verify `DATABASE_HOST`; check API logs for TypeORM errors |
| `redis` | `docker compose ps redis`; `redis-cli -h localhost ping` |
| `memory_heap` | Restart API; investigate leak; or raise `MEMORY_HEAP_LIMIT_BYTES` if legitimately large |

---

## Runbook: empty Grafana log panels

Expected until log shipping exists. Confirm Loki itself is up:

```bash
curl -s http://localhost:3100/ready
```

Should return `ready` when Loki is healthy.

---

## Runbook: local dev without Docker observability

You can run API alone with tracing to a local collector:

```bash
# Terminal 1 — only collector
docker compose -f docker/docker-compose.yml up otel-collector

# Terminal 2 — API with .env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces npm run dev:api
```

Metrics: still at http://localhost:3001/metrics (Prometheus optional).

---

## Suggested implementation order (if you extend observability)

1. **Promtail** → Loki (unlock log panels immediately)
2. **Tempo** + Collector exporter (unlock trace UI in Grafana)
3. **Counters** for scheduler / claps / cache (then add Grafana panels back)
4. **Compose healthcheck** on API readiness
5. **Web Docker** tracing import if you need SSR trace continuity in prod

---

## Related docs

- [01 — Overview](./01-overview.md)
- [04 — Metrics](./04-metrics.md)
- [Main gaps doc](../11-current-gaps.md)
