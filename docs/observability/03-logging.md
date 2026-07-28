# 03 - Logging

Logging answers this question:

```text
What did the app say happened?
```

A log is like a diary entry from the app.

Examples:

```text
Request finished
User login failed
Post created
Failed to enqueue job
```

## What PCMS Uses

The API uses:

```text
Pino + nestjs-pino
```

Pino writes structured JSON logs to stdout.

Structured JSON means logs are machine-readable:

```json
{
  "level": 30,
  "msg": "request completed",
  "trace_id": "...",
  "span_id": "..."
}
```

This is better than plain text because tools can search, filter, and parse fields.

## Where Logging Is Configured

Logger config:

```text
apps/api/src/common/logger/pino-logger.config.ts
```

App wiring:

```text
apps/api/src/app.module.ts
apps/api/src/main.ts
```

Nest uses Pino as the app logger, so normal Nest logs also go through Pino formatting.

## Log Levels

Log level controls how much the app says.

| Environment | Level | Meaning |
|---|---|---|
| Production | `info` | Normal important logs |
| Development/test-like environments | `debug` | More detailed logs |

In the code:

```text
NODE_ENV=production -> info
anything else       -> debug
```

## What A Request Log Contains

Pino HTTP logs usually include:

| Field | Meaning |
|---|---|
| `level` | Log severity as a number |
| `time` | Timestamp |
| `msg` | Log message |
| `req` | Request info, like method and URL |
| `res` | Response info, like status code |
| `trace_id` | The trace this log belongs to, if available |
| `span_id` | The specific span this log belongs to, if available |

The most useful beginner fields are:

```text
msg
req.url
res.statusCode
trace_id
```

## Why `trace_id` Matters

The logger reads the active OpenTelemetry span and adds:

```json
{
  "trace_id": "...",
  "span_id": "..."
}
```

That means:

```text
The log line and the trace can be connected.
```

If you see an error log with `trace_id=abc123`, you can look for trace `abc123` in the OpenTelemetry Collector logs.

Later, after a trace backend like Tempo or Jaeger is added, Grafana can make this easier.

## What Is Not Logged Automatically

The API skips automatic access logs for:

```text
/health
/metrics
```

Why?

Because tools call these routes frequently:

```text
Prometheus calls /metrics
health probes call /health/*
```

Logging every one would bury the useful application logs.

## Where Logs Go Today

| Environment | Where to look |
|---|---|
| Local API dev | Terminal output |
| Docker API container | `docker compose logs api` |
| Grafana Loki | Not automatic yet |

Important:

```text
Loki is running, and Grafana has log panels prepared.
But API logs are not shipped into Loki yet.
```

So empty Grafana log panels are expected until Promtail, Grafana Alloy, or another log pipeline is added.

## How To Read Logs Locally

Follow API logs:

```bash
docker compose -f docker/docker-compose.yml logs -f api
```

Find logs with trace IDs:

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | grep trace_id | tail -5
```

Pretty-print a JSON log line if you have `jq`:

```bash
docker compose -f docker/docker-compose.yml logs api 2>&1 | tail -1 | jq .
```

## Logging In Application Code

In services or controllers, use Nest's logger:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Post created');
this.logger.error('Failed to enqueue job', err.stack);
```

Because the app uses Pino, these messages go through the same structured logging setup.

## Grafana/Loki Status

Grafana has Loki configured.

The dashboard queries expect logs with a label like:

```text
job="pcms-api"
```

But there is no log shipper yet.

To make Grafana log panels work, add one of:

```text
Promtail
Grafana Alloy
Docker logging driver
OpenTelemetry logs pipeline
```

## Beginner Debugging Flow

```text
1. Something failed.
2. Check API logs.
3. Find the log line with the error.
4. Copy trace_id if present.
5. Use that trace_id to connect the log to trace output.
6. Use metrics to see whether it is a one-off issue or a widespread problem.
```

## Remember

```text
Logs are not charts.
Logs are individual events.
```

Use logs when you need specific details about what happened.

## Next

- [04 - Metrics](./04-metrics.md)
- [07 - Gaps and Runbook](./07-gaps-and-runbook.md)
