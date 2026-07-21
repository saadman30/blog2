# 03 — Logging

## What logger PCMS uses

The API uses **Pino** via **nestjs-pino**:

- Fast structured JSON logging
- One log line per HTTP request (automatic “access log” style)
- Integrated as Nest’s application logger (`app.useLogger(app.get(Logger))`)

Config factory: `apps/api/src/common/logger/pino-logger.config.ts`  
Registered in `AppModule`:

```typescript
LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: createPinoLoggerConfig,
}),
```

Bootstrap in `main.ts` uses `bufferLogs: true` so early Nest messages wait until Pino is ready.

---

## Log levels

| Environment | Level |
|-------------|-------|
| `NODE_ENV=production` | `info` |
| Anything else (e.g. development) | `debug` |

Set via `configService.get('app.nodeEnv')`.

---

## What a log line looks like

Pino HTTP logs are JSON on **stdout**. Typical fields include:

- `level` — numeric Pino level
- `time` — timestamp
- `msg` — message
- `req` / `res` — request/response metadata (method, url, statusCode)
- **`trace_id`** — OpenTelemetry trace ID (when a span is active)
- **`span_id`** — OpenTelemetry span ID (when a span is active)

The trace fields come from the `mixin()` function:

```typescript
mixin() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
}
```

**Why this matters:** you can grep logs by `trace_id` and match them to a distributed trace or to Grafana’s Loki panels.

---

## Which requests are NOT logged

Access logging is disabled for noisy probe endpoints:

```typescript
url.includes('/health') || url.includes('/metrics')
```

So Kubernetes/Docker health checks and Prometheus scrapes do not flood your logs.

Application code can still use the Nest `Logger` for business messages on those paths if needed.

---

## Where logs go

| Environment | Destination |
|-------------|-------------|
| Local `npm run dev:api` | Your terminal (stdout) |
| Docker `api` container | `docker logs <api-container>` |
| Grafana Loki | **Not automatic yet** — see [07 — Gaps](./07-gaps-and-runbook.md) |

Loki and Grafana dashboards are **prepared** (queries expect `{job="pcms-api"}` JSON logs), but Compose does not include Promtail or an OTEL logs pipeline yet. Until you add a log shipper, use `docker logs` or your platform’s log aggregation.

---

## Using the logger in your code

Inject Nest’s `Logger` in services/controllers:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Post created');
this.logger.error('Failed to enqueue job', err.stack);
```

Because `app.useLogger(Pino)` is set, these go through Pino’s formatting.

---

## Grafana Loki integration (prepared)

Datasource config: `docker/grafana/provisioning/datasources/datasources.yml`

- Loki URL: `http://loki:3100`
- **Derived field** `TraceID` regex: `"trace_id":"(\w+)"` — clicking a trace ID in logs can jump to linked telemetry (when trace backend is wired)

Dashboard log queries examples:

```logql
{job="pcms-api"} | json | line_format "{{.level}} trace_id={{.trace_id}} {{.msg}}"
```

```logql
{job="pcms-api"} | json | trace_id != ""
```

These panels work once logs with `job="pcms-api"` label reach Loki.

---

## Loki server config (short)

`docker/loki/loki-config.yml`:

- Single-node, filesystem storage
- HTTP on port 3100
- **Retention:** 168 hours (7 days)
- Auth disabled (local dev only — do not expose raw Loki to the public internet)

---

## Tips for reading logs locally

```bash
# Follow API logs in Docker
docker compose -f docker/docker-compose.yml logs -f api

# Pretty-print one JSON line (if you have jq)
docker compose -f docker/docker-compose.yml logs api 2>&1 | tail -1 | jq .
```

Look for `trace_id` on failing requests, then correlate with metrics spikes or collector trace output.

---

## Next

- [04 — Metrics](./04-metrics.md)
- [07 — Gaps & runbook](./07-gaps-and-runbook.md)
