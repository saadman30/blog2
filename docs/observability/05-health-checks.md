# 05 - Health Checks

Health checks answer this question:

```text
Is the app okay enough to run?
```

Docker, Kubernetes, load balancers, and humans can call health endpoints to see whether the API is alive and ready.

## Liveness vs Readiness

There are two different checks:

| Check | Beginner meaning | Endpoint |
|---|---|---|
| Liveness | Is the process alive? | `/health/liveness` |
| Readiness | Can it handle real traffic? | `/health/readiness` |

Think of it like this:

```text
Liveness = are you awake?
Readiness = are you ready to work?
```

An app can be alive but not ready.

Example:

```text
The API process is running,
but Postgres is down.
```

That means:

```text
Liveness might pass.
Readiness should fail.
```

## Endpoints

These routes are public and outside `/api`:

```text
GET http://localhost:3001/health/liveness
GET http://localhost:3001/health/readiness
```

They are outside `/api` because infrastructure tools expect stable probe paths that do not require authentication.

## Code Location

Controller:

```text
apps/api/src/modules/health/infrastructure/http/health.controller.ts
```

Redis indicator:

```text
apps/api/src/modules/health/infrastructure/http/redis.health-indicator.ts
```

The module uses:

```text
@nestjs/terminus
```

Terminus is Nest's health-check package.

## What Liveness Checks

Liveness checks:

```text
memory_heap
```

The app verifies that Node heap memory is under:

```text
300 MB
```

If heap memory grows beyond that, liveness fails.

## What Readiness Checks

Readiness checks:

```text
database
redis
memory_heap
```

Plain English:

```text
Can the API reach Postgres?
Can the API reach Redis?
Is memory still under the limit?
```

If any of those fail, readiness returns HTTP `503`.

## Response Shape

A successful response looks roughly like:

```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    }
  }
}
```

Readiness includes more keys when everything passes:

```text
database
redis
memory_heap
```

A failed check returns:

```text
HTTP 503
status: "error"
details about what failed
```

## Why Health Checks Are Not Logged Or Traced

Health checks are called often.

If every health check created a log and trace, the useful observability data would get noisy.

So PCMS skips health routes in:

```text
Pino access logs
OpenTelemetry HTTP traces
```

## Difference From Older Docs

Older docs may mention:

```text
/api/health
/api/health/live
```

Those are not the current observability endpoints.

Current endpoints:

```text
/health/liveness
/health/readiness
```

## Manual Checks

Check liveness:

```bash
curl -i http://localhost:3001/health/liveness
```

Check readiness:

```bash
curl -i http://localhost:3001/health/readiness
```

Pretty-print readiness:

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

## Troubleshooting

If readiness fails:

| Failed check | What to check |
|---|---|
| `database` | Is Postgres running? Is `DATABASE_HOST` correct? |
| `redis` | Is Redis running? Is `REDIS_HOST` correct? |
| `memory_heap` | Is the API using too much memory? |

Useful Docker commands:

```bash
docker compose -f docker/docker-compose.yml ps postgres
docker compose -f docker/docker-compose.yml ps redis
docker compose -f docker/docker-compose.yml logs api
```

## Remember

```text
Liveness asks: should this process be restarted?
Readiness asks: should traffic be sent here?
```

## Next

- [06 - Docker and Grafana](./06-docker-stack-and-grafana.md)
