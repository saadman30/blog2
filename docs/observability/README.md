# Observability documentation

PCMS can answer three questions about itself while it runs:

1. **What happened?** → structured **logs** (Pino)
2. **How fast / how busy?** → **metrics** (Prometheus)
3. **Which request caused what?** → **traces** (OpenTelemetry)

A Docker Compose stack can run the supporting tools (OTel Collector, Prometheus, Loki, Grafana) so you can see everything in dashboards.

| Doc | What it covers |
|-----|----------------|
| [01 — Overview](./01-overview.md) | The three pillars, how data flows, ports |
| [02 — Distributed tracing](./02-tracing.md) | OpenTelemetry in API + web, trace propagation |
| [03 — Logging](./03-logging.md) | Pino, log levels, trace_id in every log line |
| [04 — Metrics](./04-metrics.md) | Prometheus `/metrics`, custom HTTP + DB pool metrics |
| [05 — Health checks](./05-health-checks.md) | Liveness vs readiness, Terminus |
| [06 — Docker stack & Grafana](./06-docker-stack-and-grafana.md) | Compose services, dashboards, how to open Grafana |
| [07 — Gaps & runbook](./07-gaps-and-runbook.md) | What works today, what is prepared but not wired, troubleshooting |

## Quick start (full observability stack)

```bash
docker compose -f docker/docker-compose.yml up --build
```

Then open:

| Tool | URL | Login |
|------|-----|-------|
| Grafana | http://localhost:3000 | `admin` / `admin` |
| Prometheus | http://localhost:9090 | — |
| API metrics | http://localhost:3001/metrics | — |
| API liveness | http://localhost:3001/health/liveness | — |
| API readiness | http://localhost:3001/health/readiness | — |

Pre-built Grafana dashboards (folder **PCMS**):

- **PCMS Overview** — RPS, latency, errors, memory, pool, logs panel
- **PCMS API Observability** — focused API metrics + correlated logs

## Environment variables

```bash
OTEL_SERVICE_NAME=pcms-api          # or pcms-web on the web process
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Defined in root `.env.example` under `# Observability`.
