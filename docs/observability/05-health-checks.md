# 05 — Health checks

## Why health checks exist

When PCMS runs in Docker or Kubernetes, the platform needs to know:

1. **Is the process running?** → **Liveness**
2. **Can it handle real work?** → **Readiness** (DB, Redis, memory OK)

PCMS uses **@nestjs/terminus** for structured health responses.

---

## Endpoints

Controller: `apps/api/src/modules/health/health.controller.ts`

Both routes are `@Public()` (no JWT) and live **outside** `/api`:

| Probe | URL | Checks |
|-------|-----|--------|
| **Liveness** | `GET /health/liveness` | Memory heap under limit |
| **Readiness** | `GET /health/readiness` | Postgres ping + Redis ping + memory heap |

### Memory limit

```typescript
const MEMORY_HEAP_LIMIT_BYTES = 300 * 1024 * 1024; // 300 MB
```

Uses `MemoryHealthIndicator.checkHeap('memory_heap', MEMORY_HEAP_LIMIT_BYTES)`.

If heap exceeds 300 MB, the check fails.

### Database

`TypeOrmHealthIndicator.pingCheck('database')` — runs a simple DB ping through TypeORM.

### Redis

Custom `RedisHealthIndicator` (`redis.health-indicator.ts`):

1. Create a short-lived `ioredis` client (`lazyConnect: true`, `maxRetriesPerRequest: 1`)
2. `connect()` → `ping()` → expect `PONG`
3. `disconnect()` in `finally`
4. On failure, throws `HealthCheckError` with status details

Host/port from `redis.host` / `redis.port` config (same as BullMQ).

---

## Response shape (Terminus)

Successful check (simplified):

```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up" }
  },
  "error": {},
  "details": {
    "memory_heap": { "status": "up" }
  }
}
```

Readiness includes `database` and `redis` keys when all pass.

Failed check returns HTTP **503** with `status: "error"` and which indicator failed.

Then `TransformInterceptor` still wraps success responses as `{ success: true, data: ... }` — **health endpoints return Terminus format directly** through the normal pipeline; verify actual response in your environment with `curl -i`.

---

## Difference from the old health module

Earlier PCMS docs described:

- `GET /api/health`
- `GET /api/health/live`

The observability update replaced that with Kubernetes-style paths **without** the `/api` prefix:

- `/health/liveness`
- `/health/readiness`

Update any bookmarks, load balancers, or scripts accordingly.

---

## Who calls these?

| Caller | Typical use |
|--------|-------------|
| Docker Compose | Postgres/Redis have their own healthchecks; API does not define a Compose healthcheck yet |
| Kubernetes | `livenessProbe` → `/health/liveness`, `readinessProbe` → `/health/readiness` |
| You (manual) | `curl http://localhost:3001/health/readiness` before demos |

---

## Observability integration

| System | Behavior |
|--------|----------|
| Pino access logs | **Skipped** for `/health/*` |
| OTel HTTP traces | **Skipped** for URLs containing `/health` |
| Prometheus | Does not scrape health (scrapes `/metrics` only) |

---

## Module structure

```text
health.module.ts
  imports: TerminusModule
  controllers: HealthController
  providers: RedisHealthIndicator
```

No separate `HealthService` class anymore — Terminus indicators do the work.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Readiness fails `database` | Postgres down, wrong `DATABASE_HOST`, migrations/schema issue |
| Readiness fails `redis` | Redis down, wrong `REDIS_HOST`, firewall |
| Readiness fails `memory_heap` | Memory leak or limit too low for workload |
| Liveness fails but readiness OK | Unusual — liveness only checks heap; process may be wedged elsewhere |

```bash
curl -s http://localhost:3001/health/readiness | jq .
```

---

## Next

- [06 — Docker stack & Grafana](./06-docker-stack-and-grafana.md)
