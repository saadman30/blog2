# 10 — Testing

Both apps aim for **very high coverage** on the code they choose to measure. That does **not** mean every UI page has E2E tests.

---

## API — Jest

Config: `apps/api/jest.config.ts`  
Setup: `apps/api/jest.setup.ts` (reflect-metadata + DOMPurify mock)

### Run

```bash
npm run test -w @pcms/api
npm run test:cov -w @pcms/api
# or from root:
npm run test:api
```

### What is tested

Nearly every service, controller, guard, filter, interceptor, util, and strategy has a `*.spec.ts` beside it.

Examples:

- `auth.service.spec.ts`, `auth.controller.spec.ts`, `jwt.strategy.spec.ts`
- `posts.service.spec.ts`, `post-scheduler.consumer.spec.ts`
- `media.*`, `analytics.*`, `health.*`
- `common/guards/*`, `filters/*`, `interceptors/*`, `utils/*`

### Coverage policy

Threshold target: **100%** statements/branches/functions/lines on included source.

Typically **excluded** from coverage:

- `main.ts`
- `*.module.ts`
- DTOs, entities, enums
- migrations / seeds
- TypeORM data source file

Tests are mostly **unit tests with mocks** (repositories, queues, config), not a live Postgres integration suite. Folder `apps/api/test/` exists but is empty for integration harnesses.

---

## Web — Vitest

Config: `apps/web/vitest.config.ts`  
Setup: `apps/web/tests/setup.ts`

### Run

```bash
npm run test -w @pcms/web
npm run test:cov -w @pcms/web
# or:
npm run test:web
```

### Test files

| File | Focus |
|------|--------|
| `tests/api-client.test.ts` | fetch wrapper, 401 refresh retry, errors, headers |
| `tests/auth-store.test.ts` | set/clear/hydrate/SSR |
| `tests/auth-hydrate.test.tsx` | AuthHydrate calls hydrateAuth on mount |
| `tests/theme.test.ts` | theme helpers + `buildThemeBootScript` |
| `tests/ssr-env.test.ts` | node env / no window |
| `tests/content.test.ts` | TOC, dates, reading helpers |
| `tests/cn.test.ts` | className merge |
| `tests/ui.test.tsx` | Button/Badge/Card/Input |
| `tests/dialog.test.tsx` | Dialog behavior |

### Coverage include set

Coverage thresholds (100%) apply to:

- `src/utils/**`
- `src/stores/**`
- `src/components/ui/**`

**Not** included in that gate: Astro pages, `LoginForm`, `WriteForm`, `ClapButton`, layouts. Those can change without failing the coverage threshold.

### Missing test types

- No Storybook
- No Playwright / Cypress E2E
- No visual regression suite

---

## What “100% coverage” means here

It means: **the measured units have exhaustive unit tests**.

It does **not** mean:

- Every user journey is automated end-to-end
- Production Docker path is tested in CI (no CI config is documented in-repo yet)
- Static Astro pages are covered

---

## Next

- Honest inventory of unfinished pieces: [11 — Current gaps](./11-current-gaps.md)
