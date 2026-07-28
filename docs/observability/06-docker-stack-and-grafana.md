# 06 - Docker Stack And Grafana

This page explains the local observability stack.

Beginner mental model:

```text
Docker Compose starts the app plus the tools that watch the app.
```

The app services are:

```text
web
api
postgres
redis
```

The observability services are:

```text
otel-collector
prometheus
loki
grafana
```

## Start Everything

```bash
docker compose -f docker/docker-compose.yml up --build
```

This starts the full app and observability stack.

## Services

| Service | Port | Beginner meaning |
|---|---:|---|
| `postgres` | 5432 | Database |
| `redis` | 6379 | Queue/cache support |
| `api` | 3001 | Nest API, logs, metrics, traces |
| `web` | 4321 | Astro web app |
| `otel-collector` | 4317/4318 | Receives traces |
| `prometheus` | 9090 | Stores metrics |
| `loki` | 3100 | Log database, running but not receiving API logs yet |
| `grafana` | 3000 | Dashboard UI |

## What Each Observability Service Does

### OpenTelemetry Collector

The API sends traces to the Collector.

In Docker:

```text
api -> http://otel-collector:4318/v1/traces
```

Today the Collector prints traces to its Docker logs.

It does not send traces to Tempo, Jaeger, or Grafana Cloud yet.

Check Collector logs:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

### Prometheus

Prometheus scrapes metrics from:

```text
http://api:3001/metrics
```

Open Prometheus:

```text
http://localhost:9090
```

Useful page:

```text
Status -> Targets
```

The `pcms-api` target should be `UP`.

### Loki

Loki stores logs.

But important:

```text
Loki is running, but API logs are not shipped into Loki yet.
```

That means Grafana log panels can be empty even when the API is working.

To make those panels work later, add a log shipper such as:

```text
Promtail
Grafana Alloy
OpenTelemetry logs pipeline
```

### Grafana

Grafana is the dashboard UI.

Open:

```text
http://localhost:3000
```

Login:

```text
user: admin
password: admin
```

Grafana reads metrics from Prometheus.

It is also configured for Loki, but logs will only appear after log shipping is added.

## Provisioned Datasources

Grafana datasources are configured in:

```text
docker/grafana/provisioning/datasources/datasources.yml
```

Configured datasources:

| Datasource | Meaning |
|---|---|
| Prometheus | Metrics source |
| Loki | Log source, prepared for future log shipping |

Prometheus is the default datasource.

## Provisioned Dashboards

Dashboards live in:

```text
docker/grafana/dashboards/
```

Current dashboards:

| Dashboard | What it shows |
|---|---|
| PCMS Overview | Request rate, latency, errors, memory, DB pool, logs panel |
| PCMS API Observability | Focused API metrics and correlated logs panel |

Metric panels should work after Prometheus scrapes the API.

Log panels are expected to stay empty until logs are shipped to Loki.

## API Observability Environment

The API container uses:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME=pcms-api
```

The API Dockerfile starts tracing before the app:

```text
node --import ./dist/tracing.js ./dist/main.js
```

That order is important because OpenTelemetry must load before the app.

## Web Observability Environment

The web container also has:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME=pcms-web
```

But the production web Docker image serves static files with `serve`.

That means:

```text
The web OTEL environment variables have little effect in production Docker today.
```

Web tracing mainly works in dev/preview scripts.

## Generate Traffic For Dashboards

Run:

```bash
for i in $(seq 1 20); do curl -s http://localhost:3001/api/posts > /dev/null; done
```

Then wait 15-30 seconds.

Why wait?

```text
Prometheus scrapes every 15 seconds.
Grafana reads from Prometheus.
```

Open:

```text
http://localhost:3000
```

Then go to:

```text
Dashboards -> PCMS
```

You should see request-rate and latency panels move.

## Useful Checks

Prometheus target:

```text
http://localhost:9090/targets
```

Raw metrics:

```bash
curl -s http://localhost:3001/metrics | grep http_requests_total
```

API logs:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

Collector traces:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

Loki readiness:

```bash
curl -s http://localhost:3100/ready
```

## File Map

```text
docker/
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
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

## Remember

```text
Prometheus metrics -> visible in Grafana today.
Loki logs -> prepared, but not receiving API logs yet.
Collector traces -> visible in Collector logs today, not Grafana trace UI yet.
```

## Next

- [07 - Gaps and Runbook](./07-gaps-and-runbook.md)
