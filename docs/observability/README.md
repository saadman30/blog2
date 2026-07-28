# Observability docs

Observability means: **can we understand what the app is doing while it runs?**

In PCMS, observability answers three beginner-friendly questions:

| Question | Name | Tool used here |
|---|---|---|
| What happened? | Logs | Pino |
| How busy, slow, or broken is it? | Metrics | Prometheus |
| What path did one request take? | Traces | OpenTelemetry |

Simple mental model:

```text
Logs    = diary entries
Metrics = dashboard numbers
Traces  = a request's journey
```

The API is the main source of observability data. Docker Compose also starts Prometheus, Loki, the OpenTelemetry Collector, and Grafana so you can inspect that data locally.

## Start Here

If you are learning this system for the first time, read in this order:

| Step | Doc | What you learn |
|---|---|---|
| 1 | [Tutorial](./observability-tutorial.md) | The full beginner-friendly walkthrough |
| 2 | [01 - Overview](./01-overview.md) | The whole system in one picture |
| 3 | [02 - Tracing](./02-tracing.md) | What traces and spans mean |
| 4 | [03 - Logging](./03-logging.md) | How API logs work |
| 5 | [04 - Metrics](./04-metrics.md) | What Prometheus scrapes |
| 6 | [05 - Health Checks](./05-health-checks.md) | Liveness vs readiness |
| 7 | [06 - Docker and Grafana](./06-docker-stack-and-grafana.md) | What each Docker service does |
| 8 | [07 - Gaps and Runbook](./07-gaps-and-runbook.md) | What works today and what is not wired yet |

## Quick Start

Start the full stack:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Then open:

| Thing | URL | Notes |
|---|---|---|
| Grafana | http://localhost:3000 | `admin` / `admin` |
| Prometheus | http://localhost:9090 | Metrics database UI |
| API metrics | http://localhost:3001/metrics | Raw Prometheus metrics |
| API liveness | http://localhost:3001/health/liveness | Is the process alive? |
| API readiness | http://localhost:3001/health/readiness | Can the API serve real traffic? |

## What Works Today

Fully working:

- API JSON logs with `trace_id` and `span_id`
- HTTP metrics at `/metrics`
- Prometheus scraping the API
- Grafana dashboards for request rate, latency, errors, memory, and DB pool usage
- Health checks
- API traces reaching the OpenTelemetry Collector

Prepared but not fully connected:

- Grafana log panels are prepared, but logs are not shipped into Loki yet
- Traces reach the Collector, but there is no Tempo or Jaeger trace UI yet
- Browser-only interactions do not continue server traces yet

That distinction matters. If Grafana log panels are empty, the stack is not necessarily broken. Log shipping simply has not been added yet.

## Key Environment Variables

```bash
OTEL_SERVICE_NAME=pcms-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

In Docker, the API sends traces to:

```text
http://otel-collector:4318/v1/traces
```
