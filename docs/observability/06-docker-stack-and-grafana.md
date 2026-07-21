# 06 — Docker stack & Grafana

## Full Compose topology

`docker/docker-compose.yml` runs **eight** services when you start everything:

| Service | Image | Host port | Role |
|---------|-------|-----------|------|
| `postgres` | postgres:16-alpine | 5432 | App database |
| `redis` | redis:7-alpine | 6379 | BullMQ + health |
| `api` | built from `Dockerfile.api` | 3001 | Nest API + metrics + logs |
| `web` | built from `Dockerfile.web` | 4321 | Static Astro site |
| `otel-collector` | otel/opentelemetry-collector-contrib:0.120.0 | 4317, 4318 | Receives OTLP traces |
| `prometheus` | prom/prometheus:v3.2.1 | 9090 | Metrics TSDB |
| `loki` | grafana/loki:3.4.2 | 3100 | Log storage (ready) |
| `grafana` | grafana/grafana:11.5.2 | 3000 | Dashboards |

Persistent volumes: `postgres_data`, `prometheus_data`, `loki_data`, `grafana_data`.

---

## Start commands

```bash
# Everything including observability
docker compose -f docker/docker-compose.yml up --build

# App + infra only (no Grafana stack)
docker compose -f docker/docker-compose.yml up -d postgres redis api web

# Observability only (if api already running elsewhere — adjust prometheus.yml target)
docker compose -f docker/docker-compose.yml up -d otel-collector prometheus loki grafana
```

---

## API container observability env

```yaml
OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME: pcms-api
```

API starts with tracing import:

```dockerfile
CMD ["node", "--import", "./dist/tracing.js", "./dist/main.js"]
```

---

## Web container observability env

```yaml
OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME: pcms-web
```

**Note:** Production web image runs `serve` for static files **without** `instrumentation.mjs`. OTEL env vars on the web container have **little effect** until the Dockerfile loads Node instrumentation (see gaps doc).

---

## Grafana first login

| Field | Value |
|-------|-------|
| URL | http://localhost:3000 |
| User | `admin` |
| Password | `admin` |

`GF_USERS_ALLOW_SIGN_UP=false` — no self-registration.

---

## Provisioned datasources

Auto-loaded from `docker/grafana/provisioning/datasources/datasources.yml`:

### Prometheus (default)

- URL: `http://prometheus:9090`
- UID: `Prometheus`

### Loki

- URL: `http://loki:3100`
- UID: `Loki`
- Derived field: extracts `trace_id` from JSON log lines

---

## Provisioned dashboards

Folder: **PCMS** (from `docker/grafana/provisioning/dashboards/dashboards.yml`)

JSON files in `docker/grafana/dashboards/`:

### PCMS Overview (`pcms-overview.json`)

| Section | Panels |
|---------|--------|
| Application Health | Request rate (RPS), latency p95/p99, error rate % |
| Infrastructure & Database | TypeORM pool, Node heap/RSS |
| Live Structured Logs | Loki log stream with trace_id in line format |

Future metrics (scheduler, claps rate limit, Redis cache) are documented in [04 — Metrics](./04-metrics.md) but **not** shown until implemented in code.

### PCMS API Observability (`pcms-api-observability.json`)

| Panel | Query focus |
|-------|-------------|
| HTTP Request Rate | `rate(http_requests_total[5m])` |
| HTTP Error Rate | `rate(http_request_errors_total[5m])` |
| HTTP Latency p95/p99 | histogram quantiles on `http_request_duration_seconds` |
| TypeORM Connection Pool | `typeorm_pool_connections` by `state` |
| Correlated Logs by Trace ID | Loki `{job="pcms-api"} \| json \| trace_id != ""` |

Dashboard refresh: **10s** default, time range **last 1 hour**.

---

## Prometheus UI

http://localhost:9090

Useful checks:

- **Status → Targets** — `pcms-api` should be **UP**
- **Graph** — paste `sum(rate(http_requests_total[5m]))`

If target is down, API container may not be running or network misconfigured.

---

## OTel Collector ports

| Port | Protocol | Use |
|------|----------|-----|
| 4317 | gRPC OTLP | Alternative trace ingest |
| 4318 | HTTP OTLP | What PCMS apps use (`/v1/traces`) |

View received traces:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

---

## Generating traffic for dashboards

```bash
# Health (won't affect HTTP metrics much — interceptor still runs, but excluded from some noise controls differ)
curl http://localhost:3001/health/liveness

# Public API traffic (shows in metrics)
for i in $(seq 1 20); do curl -s http://localhost:3001/api/posts > /dev/null; done

# View metrics
curl -s http://localhost:3001/metrics | grep http_requests_total
```

Wait ~15–30 seconds for Prometheus scrapes and Grafana graphs to update.

---

## File reference map

```text
docker/
├── docker-compose.yml
├── Dockerfile.api              # --import tracing.js
├── Dockerfile.web              # static serve (no tracing import)
├── otel-collector/
│   └── otel-collector-config.yml
├── prometheus/
│   └── prometheus.yml
├── loki/
│   └── loki-config.yml
└── grafana/
    ├── provisioning/
    │   ├── datasources/datasources.yml
    │   └── dashboards/dashboards.yml
    └── dashboards/
        ├── pcms-overview.json
        └── pcms-api-observability.json
```

---

## Next

- [07 — Gaps & runbook](./07-gaps-and-runbook.md)
