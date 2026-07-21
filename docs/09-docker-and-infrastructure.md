# 09 — Docker & infrastructure

All Docker files live under `docker/`.

```text
docker/
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
├── otel-collector/
├── prometheus/
├── loki/
└── grafana/
```

---

## Compose services

File: `docker/docker-compose.yml`

### `postgres`

- Image: `postgres:16-alpine`
- User/password/db: `pcms` / `pcms_secret` / `pcms`
- Port: `5432:5432`
- Volume: `postgres_data` (persistent)
- Healthcheck: `pg_isready`

### `redis`

- Image: `redis:7-alpine`
- Port: `6379:6379`
- Healthcheck: `redis-cli ping`

### `api`

- Build: context repo root, `Dockerfile.api`
- `env_file: ../.env.example`
- Overrides:
  - `DATABASE_HOST=postgres`
  - `REDIS_HOST=redis`
  - `API_PORT=3001`
  - `CORS_ORIGIN=http://localhost:4321`
- Port: `3001:3001`
- Depends on healthy postgres + redis

### `web`

- Build: context repo root, `Dockerfile.web`
- Build arg: `PUBLIC_API_URL=http://localhost:3001/api`
- OTEL env for tracing (limited effect in prod — static `serve` image)
- Port: `4321:4321`
- Depends on api started

### Observability stack

See **[observability/06-docker-stack-and-grafana.md](./observability/06-docker-stack-and-grafana.md)** for full detail.

| Service | Port | Role |
|---------|------|------|
| `otel-collector` | 4317, 4318 | Receives OTLP traces from api/web |
| `prometheus` | 9090 | Scrapes `http://api:3001/metrics` |
| `loki` | 3100 | Log storage (shipper not included yet) |
| `grafana` | 3000 | Dashboards (`admin` / `admin`) |

---

## Dockerfile.api (multi-stage)

1. **deps** — `npm ci` for `@pcms/api` workspace (+ root)
2. **builder** — copy API source, `npm run build` (Nest → `dist/`)
3. **runner** — Node 20 alpine, copy `dist` + `node_modules`, `USER node`, `CMD node --import ./dist/tracing.js ./dist/main.js`, expose 3001

Production image runs compiled JS only.

---

## Dockerfile.web (multi-stage)

1. **deps** — `npm ci` for `@pcms/web`
2. **builder** — set `PUBLIC_API_URL`, `astro build` → `dist/`
3. **runner** — install `serve@14` globally, serve static `dist` on 4321

No Astro SSR server in production Docker — static files only.

---

## Local vs Docker networking

| Where you run | DATABASE_HOST | REDIS_HOST | Browser → API |
|---------------|---------------|------------|---------------|
| API on host, DB in Docker | `localhost` | `localhost` | `localhost:3001` |
| Full compose | `postgres` | `redis` | `localhost:3001` (from your machine) |

Inside the Docker network, containers talk by service name. Your browser always uses `localhost` ports published by Compose.

---

## Useful commands

```bash
# Infra only
docker compose -f docker/docker-compose.yml up -d postgres redis

# Everything
docker compose -f docker/docker-compose.yml up --build

# Tear down (keeps volume unless -v)
docker compose -f docker/docker-compose.yml down
```

---

## What Docker does *not* do yet

- No reverse proxy (nginx/Caddy) in compose
- No automatic migration step in API Dockerfile CMD
- No dedicated volume for `./uploads` media files in compose (uploads inside container FS unless you add a volume)
- Web build-time fetch of posts may see empty API during image build; blog index fallback may be baked in unless you rebuild when API has data

---

## Next

- [10 — Testing](./10-testing.md)
