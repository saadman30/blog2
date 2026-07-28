# 02 - Tracing

Tracing answers this question:

```text
What happened during this one request?
```

Metrics can tell you:

```text
The API was slow around 2:15 PM.
```

Tracing can tell you:

```text
This specific GET /api/posts request spent most of its time waiting on the database.
```

## Trace vs Span

A **trace** is the whole journey.

A **span** is one step inside that journey.

Example:

```text
Trace ID: abc123

Span 1: GET /api/posts
  Span 2: Nest route handler
  Span 3: Postgres query
  Span 4: Redis call
```

Beginner translation:

```text
Trace = full trip
Span  = one stop during the trip
```

Every span in the same journey shares the same `trace_id`.

Each span has its own `span_id`.

## What PCMS Uses

PCMS uses:

| Thing | Meaning |
|---|---|
| OpenTelemetry | The standard library/tooling for traces |
| OTLP | The format/protocol used to send traces |
| OTel Collector | A local service that receives traces |

The API sends traces to:

```text
http://otel-collector:4318/v1/traces
```

In local non-Docker development, the default is:

```text
http://localhost:4318/v1/traces
```

## API Tracing

API tracing starts in:

```text
apps/api/src/tracing.ts
```

That file creates an OpenTelemetry `NodeSDK`.

It configures:

```text
service name  -> pcms-api
trace exporter -> OTLP over HTTP
instrumentation -> automatic HTTP/Express tracing
```

## Why Tracing Must Start First

OpenTelemetry needs to patch/instrument libraries before the app imports them.

That is why the API starts Node like this:

```text
node --import ./dist/tracing.js ./dist/main.js
```

Plain English:

```text
Load tracing first.
Then load the Nest app.
```

If tracing loads too late, OpenTelemetry may miss early HTTP or framework work.

## What Gets Traced

The API automatically traces:

| Area | Status |
|---|---|
| Incoming HTTP requests | Yes |
| Outgoing HTTP requests | Yes |
| Express/Nest request handling | Yes |
| File system calls | No, intentionally disabled |
| Health and metrics endpoints | No, intentionally ignored |

Health and metrics endpoints are skipped because they are called frequently by tools. Tracing them would create noise.

Skipped URL patterns:

```text
/health
/metrics
```

## What Happens To A Trace

For a normal API request:

```text
1. Request arrives at API.
2. OpenTelemetry creates or continues a span.
3. Nest handles the request.
4. Pino can read the active span and add trace_id/span_id to logs.
5. The request finishes.
6. OpenTelemetry sends the span to the Collector.
7. The Collector prints it to its Docker logs today.
```

Important: the Collector receives traces, but does not store them in a trace UI yet.

So today you inspect traces with:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

## Web Tracing

The web app has tracing setup in:

```text
apps/web/src/instrumentation.mjs
```

It is used in dev/preview when Node starts with:

```bash
NODE_OPTIONS='--import ./src/instrumentation.mjs'
```

What this can trace:

```text
Astro dev/preview server requests
server-side HTTP calls from the web app
```

What this does not trace today:

```text
browser-only React island clicks
static files served by the production Docker web image
```

## Trace Propagation

Trace propagation means:

```text
Pass the current trace ID from one service to the next.
```

Example:

```text
Web request starts trace abc123
  -> Web calls API
  -> API continues trace abc123
```

Without propagation, the web and API would create separate traces, and you would lose the full journey.

The helper is:

```text
apps/web/src/utils/trace-headers.ts
```

It injects W3C trace headers:

```text
traceparent
tracestate
```

Those headers let the API continue the same trace.

## Browser Limitation

`injectTraceHeaders()` does nothing in the browser today.

That means browser-only calls like a client-side button click do not continue a server trace yet.

This is expected with the current implementation.

Possible future fixes:

```text
Add browser OpenTelemetry
or pass trace context from server-rendered HTML into client code
```

## Logs And Traces Connect

Pino reads the active OpenTelemetry span and adds:

```json
{
  "trace_id": "...",
  "span_id": "..."
}
```

That means a log line and a trace can share the same `trace_id`.

Beginner workflow:

```text
1. See a bad or slow request in logs.
2. Copy the trace_id.
3. Find the same trace in the Collector logs.
```

Later, after Tempo or Jaeger is added, this can become clickable in Grafana.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `OTEL_SERVICE_NAME` | `pcms-api` or `pcms-web` | Name shown on traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | Where spans are sent |

In Docker Compose:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME=pcms-api
```

## Quick Check

Start the stack:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Generate API traffic:

```bash
curl http://localhost:3001/api/posts
```

Watch the Collector:

```bash
docker compose -f docker/docker-compose.yml logs -f otel-collector
```

You should see span batches after requests.

## Remember

```text
Metrics tell you something got slow.
Logs tell you what the app said.
Traces tell you where one request went.
```

## Next

- [03 - Logging](./03-logging.md)
- [07 - Gaps and Runbook](./07-gaps-and-runbook.md)
