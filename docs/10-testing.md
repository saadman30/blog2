# 10 — Testing (tutorial)

This guide walks through **how testing works in PCMS**, not just which commands to run. By the end you should be able to:

1. Run API and web tests (with and without coverage)
2. Explain why we mock ports instead of hitting Postgres
3. Read an existing `*.spec.ts` / `*.test.ts` and know what it proves
4. Add a new unit test that keeps the **100% coverage** gate green
5. Know what “100% coverage” does **not** cover (pages, E2E, Docker)

If you only need commands, jump to [§2 Run the suites](#2-run-the-suites). For “how do I write my first test?”, start at [§4 Tutorial: test an API use case](#4-tutorial-test-an-api-use-case).

---

## 1. Mental model — what we test and why

PCMS has **two separate test runners**:

| App | Runner | Where tests live | Environment |
|-----|--------|------------------|-------------|
| `@pcms/api` | **Jest** + `ts-jest` | Colocated `*.spec.ts` next to source | Node |
| `@pcms/web` | **Vitest** + jsdom | Mostly `apps/web/tests/*.test.ts(x)` | Browser-like DOM |

Both enforce a **global 100% coverage threshold** on a defined include/exclude set. That is a **unit-test quality gate**, not a claim that every user journey is automated.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         What a “unit” means here                          │
│                                                                          │
│  API application service                                                 │
│    ├── depends on ports (interfaces)                                     │
│    └── test: real service + mocked ports (no DB, no Redis, no BullMQ)    │
│                                                                          │
│  API infrastructure adapter (TypeORM, bcrypt, Sharp, …)                  │
│    └── test: real adapter + mocked TypeORM / fs / libs                   │
│                                                                          │
│  API controller / guard / interceptor                                    │
│    └── test: new Class(mockDeps) — we do NOT boot Nest TestingModule     │
│                                                                          │
│  Web util / store / UI primitive                                         │
│    └── test: Vitest + Testing Library; stub fetch / sessionStorage       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why this shape?** The API is hexagonal: application code talks to **ports**. Mocking ports keeps tests fast, deterministic, and free of Docker/Postgres. Infrastructure tests mock the next layer down (TypeORM `Repository`, Redis client, etc.). Controllers stay thin — tests prove cookie headers and DTO wiring, not business rules (those live in the service specs).

**Assumption this doc makes:** you already have `npm install` done at the repo root. You do **not** need Postgres or Redis running to pass unit tests.

---

## 2. Run the suites

From the **repo root**:

```bash
# Both apps, no coverage report (faster feedback)
npm test

# API with coverage (fails if any included line/branch is uncovered)
npm run test:api

# Web with coverage
npm run test:web
```

Workspace-scoped equivalents:

```bash
npm run test -w @pcms/api
npm run test:cov -w @pcms/api

npm run test -w @pcms/web
npm run test:cov -w @pcms/web
```

### What success looks like

- Jest prints a suite list ending in something like `Test Suites: N passed`.
- With `--coverage`, a table of files appears; if any metric dips below **100%**, the process exits non-zero.
- HTML reports (when coverage ran):
  - API: `apps/api/coverage/lcov-report/index.html`
  - Web: `apps/web/coverage/index.html` (Vitest/v8 layout)

### Focus one file while developing

```bash
# API — one suite
npm run test -w @pcms/api -- --testPathPattern=auth.service.spec

# Web — one file
npm run test -w @pcms/web -- tests/api-client.test.ts

# Watch mode (web)
cd apps/web && npx vitest
```

---

## 3. API testing with Jest — how the machinery works

### 3.1 Config files

| File | Role |
|------|------|
| `apps/api/jest.config.ts` | Discover `*.spec.ts` / `*.test.ts`, transform with `ts-jest`, coverage include/exclude, **100% thresholds** |
| `apps/api/jest.setup.ts` | Loaded before every suite via `setupFiles` |

**`jest.setup.ts` does two things:**

1. `import 'reflect-metadata'` — Nest and `class-transformer` need this even in unit tests.
2. Mocks `isomorphic-dompurify` with a tiny regex that strips `<script>…</script>` — so content sanitization tests do not pull a full DOMPurify/JSDOM stack into every suite.

You almost never edit setup unless a new global dependency needs the same treatment.

### 3.2 Discovery and naming

From `jest.config.ts`:

```ts
testRegex: '.*\\.(spec|test)\\.ts$',
```

Convention in this repo: **colocate** specs next to the unit under test.

```text
apps/api/src/modules/auth/application/auth.service.ts
apps/api/src/modules/auth/application/auth.service.spec.ts   ← same folder
```

There is an empty `apps/api/test/` folder reserved for future integration harnesses. **Do not** put new unit tests there unless you are deliberately adding a live DB suite (none exists today).

### 3.3 Coverage include / exclude (read this before panicking)

Jest collects coverage from `src/**/*.ts`, then **excludes**:

| Excluded pattern | Why |
|------------------|-----|
| `main.ts`, `tracing.ts`, `*.module.ts` | Bootstrap / Nest wiring — hard to unit-test meaningfully |
| `*.dto.ts`, `*.entity.ts`, `*.enum.ts` | Data shapes; validated at runtime by pipes / TypeORM |
| `*.port.ts`, `*.model.ts`, `*.types.ts`, `src/domain/**` | Interfaces / plain models — no behavior |
| Migrations, seeds, TypeORM data source | Ops scripts |
| Some metrics provider/constant files | Declarative registration |

**Everything else under `src/` that has logic must be covered** — services, controllers, adapters, guards, filters, interceptors, utils, strategies, mappers.

If coverage fails after you add a private helper, either:

- add a test that exercises the new branch, or  
- (rarely) exclude it only if it is truly wiring with no behavior — prefer testing over excluding.

### 3.4 Important pattern: no `TestingModule`

Unlike many Nest tutorials, **PCMS does not use** `@nestjs/testing`’s `Test.createTestingModule(...)` in specs today. Controllers and services are constructed with `new`:

```ts
service = new AuthService(users, passwordHasher, tokenService);
controller = new AuthController(authService as unknown as AuthService);
```

That keeps suites light and forces you to mock only what the constructor needs. Prefer this style when adding tests.

### 3.5 Layer-by-layer: what each kind of test proves

#### A. Application services (use cases)

**Example:** `auth.service.spec.ts`, `posts.service.spec.ts`

1. Build `jest.Mocked<SomePort>` objects with `jest.fn()` for every method.
2. `new PostsService(posts, analytics, scheduler, htmlRenderer)`.
3. Arrange mock return values → call the method → assert results **and** which ports were called.

```ts
// Pattern (simplified from posts.service.spec.ts)
beforeEach(() => {
  posts = {
    save: jest.fn(async (v) => ({ ...basePost, ...v, id: v.id ?? 'p1' })),
    findBySlugExact: jest.fn(),
    // …other port methods
  };
  // …other ports
  service = new PostsService(posts, analytics, scheduler, htmlRenderer);
});

it('creates draft posts', async () => {
  posts.findBySlugExact.mockResolvedValue(null);
  const post = await service.create(author, { title: 'Hello', content: 'body' });
  expect(post.slug).toBe('hello');
  expect(analytics.ensureForPost).toHaveBeenCalledWith('p1');
});
```

**What you are proving:** business rules (slug uniqueness, scheduled-without-date throws, role on register, etc.) without Postgres.

**Rule of thumb:** mock **ports**, not concrete TypeORM classes, in application specs.

#### B. HTTP controllers

**Example:** `auth.controller.spec.ts`

Controllers should stay thin. Specs mock the application service and fake Express `Request` / `Response`:

```ts
res = { cookie: jest.fn(), clearCookie: jest.fn() };
await controller.login({ email: 'a@b.com', password: 'password1' }, res as Response);
expect(res.cookie).toHaveBeenCalled();
```

**What you are proving:** cookie options (`httpOnly`, `sameSite`, `secure` in production), missing refresh cookie → `UnauthorizedException`, logout clears cookie. Business validation stays in the service tests.

#### C. Persistence adapters & mappers

**Example:** `typeorm-post.repository.spec.ts`, `user.mapper.spec.ts`

- Repository adapter: mock TypeORM `Repository` (`create`, `save`, `findOne`, `createQueryBuilder`, …).
- Mapper: pure functions — pass a fake entity, assert domain shape (including defaults like empty `posts: []`).

#### D. Other adapters (security, storage, messaging, rendering)

Same idea: real adapter class + mocked bcrypt / fs / BullMQ queue / Sharp / Redis client. See `bcrypt-password-hasher.adapter.spec.ts`, `local-file-storage.adapter.spec.ts`, `bullmq-post-scheduler.adapter.spec.ts`.

#### E. Common layer (guards, filters, interceptors)

**Example:** `roles.guard.spec.ts`, `transform.interceptor.spec.ts`

Build a minimal fake `ExecutionContext` or `CallHandler`, call the unit, assert allow/deny or `{ success, data }` envelope.

```ts
// transform.interceptor — proves the API response contract
expect(result).toEqual({ success: true, data: 'payload' });
```

---

## 4. Tutorial: test an API use case

Walk through the same steps you would for a real change. We will pretend you added a method on `AuthService` and need coverage.

### Step 1 — Find the neighbor spec

Open the production file and its sibling:

```text
apps/api/src/modules/auth/application/auth.service.ts
apps/api/src/modules/auth/application/auth.service.spec.ts
```

Copy the `beforeEach` mock setup; do not reinvent port mocks from scratch.

### Step 2 — Name the behavior, not the implementation

Good:

- `rejects duplicate email`
- `always assigns editor role on register`
- `enforces two-factor when enabled`

Avoid: `calls findByEmail` as the only assertion (that is an implementation detail unless the call itself is the contract).

### Step 3 — Arrange → Act → Assert

```ts
it('rejects duplicate email', async () => {
  users.findByEmail.mockResolvedValue(user); // arrange
  await expect(                                    // act + assert
    service.register({ email: 'a@b.com', password: 'password1' }),
  ).rejects.toBeInstanceOf(ConflictException);
});
```

For success paths, assert **return value** and **side-effect mocks** (`expect(users.create).toHaveBeenCalledWith(...)`).

### Step 4 — Cover branches until coverage is green

100% branches means every `if` / ternary / `&&` short-circuit on included files needs a case. Common misses:

- Optional DTO fields (`summary` present vs absent)
- `null` vs empty array from the DB mapper
- `NODE_ENV === 'production'` cookie flags
- Error paths (`NotFoundException`, `BadRequestException`)

### Step 5 — Verify

```bash
npm run test:api
```

Open `apps/api/coverage/lcov-report/index.html` if anything fails — red lines show the exact branch still uncovered.

### Checklist when adding a new API file

| Layer you added | Spec to add | Mock |
|-----------------|-------------|------|
| `application/*.service.ts` | `*.service.spec.ts` | ports |
| `infrastructure/http/*.controller.ts` | `*.controller.spec.ts` | service |
| `infrastructure/persistence/*repository*` | `*.spec.ts` | TypeORM repo |
| Mapper | `*.mapper.spec.ts` | none (pure) |
| Guard / interceptor / filter | colocated `*.spec.ts` | Reflector / context fakes |

---

## 5. Web testing with Vitest — how the machinery works

### 5.1 Config files

| File | Role |
|------|------|
| `apps/web/vitest.config.ts` | React plugin, `@` → `src` alias, jsdom, coverage thresholds |
| `apps/web/tests/setup.ts` | `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument`, …) |

Key settings:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  coverage: {
    include: [
      'src/utils/**/*.ts',
      'src/stores/**/*.ts',
      'src/components/ui/**/*.{ts,tsx}',
    ],
    thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
}
```

### 5.2 What is inside the coverage gate vs outside

**Measured (must stay at 100%):**

- `src/utils/**` — API client, content helpers, `cn`, theme, trace headers, …
- `src/stores/**` — e.g. `auth-store`
- `src/components/ui/**` — Button, Badge, Card, Input, Dialog, …

**Not in the coverage threshold** (can change without failing `test:cov`):

- Astro pages and layouts
- Feature islands like `LoginForm`, `WriteForm`, `ClapButton`
- Back-office pages under `/app`

There is still a small test for `AuthHydrate` (mount → `hydrateAuth`) even though broader islands are not gated.

### 5.3 Current web test map

| File | Focus |
|------|--------|
| `tests/api-client.test.ts` | `apiFetch` envelope, errors, Content-Type, **401 → refresh → retry** |
| `tests/auth-store.test.ts` | `setAuth` / `clearAuth` / `hydrateAuth` / sessionStorage |
| `tests/auth-hydrate.test.tsx` | React island calls hydrate on mount |
| `tests/theme.test.ts` | theme helpers + boot script |
| `tests/ssr-env.test.ts` | code paths without `window` |
| `tests/content.test.ts` | TOC, dates, reading helpers |
| `tests/cn.test.ts` | className merge |
| `tests/trace-headers.test.ts` | OpenTelemetry header helpers |
| `tests/ui.test.tsx` | Button / Badge / Card / Input |
| `tests/dialog.test.tsx` | Dialog open content |

---

## 6. Tutorial: test a web util or store

### Example A — pure util / store (no React)

Follow `auth-store.test.ts`:

1. Import from `@/stores/...` or `@/utils/...` (alias works because of Vitest config).
2. Reset state in `afterEach` (`clearAuth()`, `sessionStorage.clear()`, `vi.restoreAllMocks()`).
3. Assert store getters / return values.

```ts
afterEach(() => {
  clearAuth();
  window.sessionStorage.clear();
});

it('hydrates from session storage', () => {
  window.sessionStorage.setItem('pcms-access-token', 't');
  window.sessionStorage.setItem(
    'pcms-user',
    JSON.stringify({ id: '1', email: 'a@b.com', role: 'EDITOR' }),
  );
  expect(hydrateAuth().user?.email).toBe('a@b.com');
});
```

### Example B — stubbing `fetch` (API client)

Follow `api-client.test.ts`. Vitest’s `vi.stubGlobal('fetch', …)` replaces the browser fetch:

```ts
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { ok: true } }),
  }),
);
await expect(apiFetch<{ ok: boolean }>('/health', { method: 'GET' }, 'token')).resolves.toEqual({
  ok: true,
});
```

The refresh-retry test chains three mock responses: **401** → successful `/auth/refresh` → successful retry. That documents the real client contract with the API `{ success, data }` envelope.

### Example C — React UI with Testing Library

Follow `ui.test.tsx` / `dialog.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';

render(<Button variant="outline">Go</Button>);
expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
```

Prefer **roles and accessible names** over CSS selectors — it matches how users (and assistive tech) see the UI.

### Verify

```bash
npm run test:web
```

---

## 7. How a change flows through tests (recommended habit)

When you implement a feature, treat tests as the definition of done:

```text
1. Write or extend the unit that holds the rule (service / util)
       → verify: new/updated *.spec.ts or *.test.ts fails for the right reason
2. Implement the minimal code to pass
       → verify: npm run test -w @pcms/api  (or web)
3. Wire controller / UI
       → verify: thin controller or component tests if the file is in coverage
4. Run coverage gate for the app you touched
       → verify: npm run test:api  and/or  npm run test:web
5. Manually click the happy path once in the browser if UI changed
       → (no E2E suite yet — this is intentional for now)
```

---

## 8. Reading a coverage failure

1. Run `npm run test:api` or `npm run test:web`.
2. Scroll to the Jest/Vitest summary: it names the metric (`Branches`, `Functions`, …) that dipped below 100%.
3. Open the HTML report and click the red file.
4. Uncovered lines are highlighted — write a case that hits that branch (do not delete the branch to “fix” coverage unless the code is dead and you are cleaning your own change).

**API tip:** private methods are covered only through public methods. Prefer asserting public behavior over exporting helpers “for testing.”

**Web tip:** if you add a file under `src/utils/` or `src/components/ui/`, it is **automatically** in the coverage include set — a new file with zero tests will fail `test:web`.

---

## 9. What we do **not** have (yet)

Be honest when reviewing PRs or planning work:

| Missing | Implication |
|---------|-------------|
| Playwright / Cypress | Login → write post → publish is **manual** |
| Nest e2e / live Postgres suite | `apps/api/test/` is empty; DB SQL bugs can slip past unit mocks |
| Storybook / visual regression | UI polish is review-based |
| Documented CI pipeline in-repo | Run `npm run test:api` and `npm run test:web` locally before merge |
| Full Astro page coverage | SSG pages are outside the Vitest threshold |

“100% coverage” here means: **every measured unit has exhaustive unit tests**. It does **not** mean every production path is safe without manual QA.

---

## 10. Quick reference card

```bash
# From repo root
npm test                 # api then web, no coverage thresholds path via package scripts
npm run test:api         # Jest + 100% coverage (@pcms/api)
npm run test:web         # Vitest + 100% coverage on utils/stores/ui
```

| Question | Answer |
|----------|--------|
| Where do API tests live? | Next to source: `foo.ts` → `foo.spec.ts` |
| Where do web tests live? | Prefer `apps/web/tests/` |
| Mock what in service tests? | Ports (`*Port`) |
| Boot Nest in tests? | No — `new Service(mocks)` |
| Response envelope? | Controllers return data; `TransformInterceptor` wraps `{ success, data }` (tested in common specs) |
| Need Docker for unit tests? | No |

---

## Next

- Honest inventory of unfinished product pieces: [11 — Current gaps](./11-current-gaps.md)
- How login/publish flows work end-to-end (for manual testing): [08 — Request flows](./08-request-flows.md)
- API structure (so you know where to put the next `*.spec.ts`): [05 — API deep dive](./api/05-api-deep-dive.md)
