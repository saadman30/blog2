# Hexagonal architecture tutorial — how `@pcms/api` is built

This guide teaches **hexagonal architecture (ports & adapters) through the PCMS NestJS API** (`apps/api`). By the end you should be able to:

1. Explain the dependency rule in plain English and spot violations
2. Name every layer in a feature folder and say what belongs there
3. Trace a real request (register → login → schedule a post) through ports and adapters
4. Explain **why** PCMS chose Symbol tokens, mappers, and one service per feature
5. Add a new capability the “PCMS way” without leaking TypeORM into business logic
6. Write a unit test that mocks ports instead of Postgres

If you only need a quick sketch, use [01 — Overview](../01-overview-and-architecture.md#architecture-style-of-the-api). For a route/service map, use [05 — API deep dive](./05-api-deep-dive.md). This doc is the **tutorial path**.

**Assumption:** you can open files under `apps/api/src/modules/`. You do **not** need Postgres or Redis running to understand the architecture; unit tests mock ports.

---

## 1. Mental model — the restaurant analogy

Forget Nest for a moment. Imagine a restaurant:

| Restaurant | PCMS API |
|------------|----------|
| **Kitchen recipes** (what a dish *is*) | **Domain** — `User`, `Post`, enums |
| **Chef** (decides what to cook and in what order) | **Application** — `AuthService`, `PostsService`, … |
| **Order window** (how waiters ask for food) | **Ports** — interfaces like `UserRepositoryPort` |
| **Waiters / suppliers** (bring tickets in, fetch ingredients) | **Adapters** — controllers, TypeORM, bcrypt, BullMQ |
| **Manager who hired the suppliers** | **Nest `*.module.ts`** — binds ports → adapters |

The chef never walks to the farm. The chef says “I need 200g of flour” (a **port**). Today a local supplier delivers it (a **driven adapter**). Tomorrow you switch suppliers; the recipes and the chef stay the same.

**Driving** vs **driven** (the two sides of the hexagon):

```text
  OUTSIDE WORLD                         INSIDE (your rules)
  ─────────────                         ───────────────────

  HTTP request  ──driving──►  Application service  ──driven──►  Database
  Queue job     ──driving──►       (chef)          ──driven──►  Redis / disk
  Cron / CLI    ──driving──►                       ──driven──►  bcrypt / JWT
```

- **Driving adapters** push work *into* the app (controllers, BullMQ consumers).
- **Driven adapters** are called *by* the app to talk to the outside (repos, hashers, storage).

**Why PCMS uses this:** business rules (“reject duplicate email”, “only publish when scheduled time arrives”) should not import TypeORM, BullMQ, Sharp, or `fs`. Those are swapable details. Hexagonal makes that separation visible in folders and in import directions.

---

## 2. The one rule that matters

```text
domain  ←  application  ←  infrastructure / Nest module
```

Arrows mean “may depend on”. Imports must point **inward**.

| Layer | May import | Must not import |
|-------|------------|-----------------|
| **Domain** | Plain TypeScript only | Nest, TypeORM, HTTP, queues, `fs`, bcrypt, … |
| **Application** | Domain + **port interfaces** + Nest DI/exceptions (pragmatism) | TypeORM, BullMQ, bcrypt, Sharp, `fs`, `marked` |
| **Infrastructure** | Anything (frameworks, ORMs, libs) | — (this is the edge) |
| **`*.module.ts`** | Ports + adapters | — (this is the wiring board) |

**How to check yourself:** open an `application/*.service.ts`. If you see `from 'typeorm'` or `from 'bcrypt'`, that is a bug. If you see `@Inject(SOME_PORT)`, that is correct.

PCMS documents an intentional compromise: application services *may* use Nest’s `@Injectable()` and HTTP exceptions (`ConflictException`, …). That keeps Nest ergonomic without dragging I/O libraries into the core. Guards/filters stay in `src/common/` (framework edge).

---

## 3. Where things live in this repo

### Big picture

```text
apps/api/src/
├── domain/                 # SHARED KERNEL (User, UserRole, PostStatus)
├── database/entities/      # TypeORM tables — NOT domain
├── common/                 # Nest guards, filters, utils (framework edge)
└── modules/
    ├── auth/
    ├── posts/
    ├── media/
    ├── analytics/
    └── health/             # thinner hexagon (see §10)
```

### Inside one feature (auth / posts / media / analytics)

```text
modules/<feature>/
├── domain/                      # plain models / types for this feature
├── application/
│   ├── ports/*.port.ts          # interface + Symbol token
│   └── *.service.ts             # use cases (the “chef”)
├── infrastructure/
│   ├── http/                    # driving: controllers + DTOs
│   ├── persistence/             # driven: TypeORM adapters + mappers
│   └── …                        # security, messaging, storage, …
└── <feature>.module.ts          # composition root: port → adapter
```

**Why per-module hexagons (not one giant `application/` folder)?**  
Each Nest feature owns its use cases and ports. That matches how teams change auth without opening posts files, and how Nest modules already isolate providers. Shared ideas (`User`, `UserRole`, `PostStatus`) live in `src/domain/` so modules do not copy enums.

**Why entities are under `database/entities/`, not `domain/`?**  
A TypeORM entity knows about columns, relations, and decorators. A domain `User` is “what the app means by a user.” Mixing them couples business logic to the ORM. Mappers convert at the adapter edge.

---

## 4. Vocabulary with PCMS names

| Term | In this repo | Example |
|------|--------------|---------|
| **Domain model** | Plain interface/class | `User`, `Post`, `Media` |
| **Port** | Interface + `Symbol` token in `application/ports/` | `USER_REPOSITORY` + `UserRepositoryPort` |
| **Driven adapter** | Class that `implements` a port | `TypeOrmUserRepository`, `BcryptPasswordHasherAdapter` |
| **Driving adapter** | Receives external input; calls the service | `AuthController`, `PostSchedulerConsumer` |
| **Composition root** | Nest module that binds tokens | `auth.module.ts` |
| **Mapper** | Entity ↔ domain conversion | `UserMapper.toDomain` |

A port file always looks like this pattern:

```1:19:apps/api/src/modules/auth/application/ports/user.repository.port.ts
import { UserRole } from '../../../../domain';
import { User } from '../../domain/user.model';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface CreateUserData {
  email: string;
  password: string;
  role: UserRole;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  save(user: User): Promise<User>;
}
```

**Why `Symbol('USER_REPOSITORY')` instead of a string or the interface itself?**

1. Nest DI needs a **runtime token**. TypeScript interfaces are erased at compile time, so you cannot inject `UserRepositoryPort` by type alone.
2. `Symbol(...)` is unique — no accidental collision with another string token named `"USER_REPOSITORY"`.
3. Colocating the token next to the interface means one import gives you both the type and the token.

---

## 5. Worked example A — register a user (full vertical slice)

This is the best first story to follow in the codebase.

### 5.1 Picture

```text
POST /api/auth/register
        │
        ▼
┌───────────────────┐  driving adapter
│  AuthController   │  validates RegisterDto, sets cookie
└─────────┬─────────┘
          │ calls
          ▼
┌───────────────────┐  application (rules only)
│   AuthService     │  “email unique? hash password; create EDITOR; issue JWTs”
└─────────┬─────────┘
          │ via ports
          ├──────────────► USER_REPOSITORY     → TypeOrmUserRepository → Postgres
          ├──────────────► PASSWORD_HASHER     → BcryptPasswordHasherAdapter
          └──────────────► TOKEN_SERVICE       → JwtTokenAdapter
```

### 5.2 Driving adapter (HTTP)

The controller stays thin: map HTTP → service → HTTP. No password hashing here.

```17:34:apps/api/src/modules/auth/infrastructure/http/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.tokens.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }
```

**Why cookies live in the controller, not the service?**  
Setting an HttpOnly cookie is an HTTP concern. The application returns *tokens*; the driving adapter decides how to deliver the refresh token (cookie today, maybe something else later).

### 5.3 Application service (business rules)

```30:57:apps/api/src/modules/auth/application/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
  ) {}

  async register(dto: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await this.passwordHasher.hash(dto.password);
    const saved = await this.users.create({
      email: dto.email.toLowerCase(),
      password,
      role: UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
    const tokens = await this.issueTokens(saved);
    return { user: this.sanitizeUser(saved), tokens };
  }
```

Read the rules without knowing the database:

1. Normalize email to lowercase.
2. Reject duplicates.
3. Hash the password (how? unknown — port).
4. Always assign `EDITOR` (client cannot self-promote to `ADMIN`).
5. Issue tokens; return a sanitized public user (no password).

**Why three ports instead of one “AuthInfra” blob?**  
Each port is a different *kind* of dependency: persistence, crypto, tokens. You can mock or swap them independently in tests. A god-port would force every test to stub JWT just to check “duplicate email.”

### 5.4 Driven adapters

**Password hashing** — tiny adapter; the service never imports `bcrypt`:

```1:14:apps/api/src/modules/auth/infrastructure/security/bcrypt-password-hasher.adapter.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasherAdapter implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
```

**User repository** — TypeORM stays here; domain models leave via a mapper:

```12:33:apps/api/src/modules/auth/infrastructure/persistence/typeorm-user.repository.ts
@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.usersRepository.findOne({ where: { email } });
    return entity ? UserMapper.toDomain(entity) : null;
  }
  // …
  async create(data: CreateUserData): Promise<User> {
    const entity = this.usersRepository.create(UserMapper.toCreateEntity(data));
    const saved = await this.usersRepository.save(entity);
    return UserMapper.toDomain(saved);
  }
```

**Why mappers?**  
`UserEntity` has TypeORM decorators and relation fields. The application should see a plain `User`. If you later change a column name, you fix the mapper — not every use case.

### 5.5 Composition root (the wiring)

```33:39:apps/api/src/modules/auth/auth.module.ts
  providers: [
    AuthService,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenAdapter },
  ],
```

This is the **only** place that knows “user storage = TypeORM” and “hashing = bcrypt.” Change the binding → change the implementation for the whole module.

---

## 6. Worked example B — media upload (why ports make swaps easy)

Media is the clearest “swap the adapter later” story in PCMS.

### Ports the service uses

```25:33:apps/api/src/modules/media/application/media.service.ts
@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(IMAGE_PROCESSOR)
    private readonly imageProcessor: ImageProcessorPort,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStoragePort,
  ) {}
```

Upload flow in English:

1. Make a unique `.webp` key.
2. Ask `IMAGE_PROCESSOR` to convert the buffer to WebP (Sharp today).
3. Ask `FILE_STORAGE` to write bytes (local disk today).
4. Ask `MEDIA_REPOSITORY` to save metadata (Postgres).

```35:50:apps/api/src/modules/media/application/media.service.ts
  async upload(file: UploadedFileLike, alt?: string): Promise<Media> {
    const key = `${uuidv4()}.webp`;
    await this.fileStorage.ensureDir();

    const webpBuffer = await this.imageProcessor.toWebp(file.buffer);
    await this.fileStorage.write(key, webpBuffer);

    const url = `/uploads/${key}`;
    return this.mediaRepository.save({
      url,
      key,
      mimeType: 'image/webp',
      size: webpBuffer.length,
      alt: alt ?? null,
    });
  }
```

### The storage port is deliberately small

```1:7:apps/api/src/modules/media/application/ports/file-storage.port.ts
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStoragePort {
  ensureDir(): Promise<void>;
  write(key: string, data: Buffer): Promise<void>;
  unlink(key: string): Promise<void>;
}
```

**Why this shape?**  
The use case only needs “put bytes at a key / delete a key.” It does not need S3 bucket names, credentials, or `fs.promises`. Env already has `S3_*` keys for a future adapter; today `MediaModule` binds local disk:

```16:21:apps/api/src/modules/media/media.module.ts
  providers: [
    MediaService,
    { provide: MEDIA_REPOSITORY, useClass: TypeOrmMediaRepository },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessorAdapter },
    { provide: FILE_STORAGE, useClass: LocalFileStorageAdapter },
  ],
```

To add S3 later you would:

1. Write `S3FileStorageAdapter implements FileStoragePort`.
2. Change one line in `media.module.ts` (or choose by config).
3. Leave `MediaService` untouched.

That is the payoff of hexagonal design in this repo — not theory, a planned swap point.

---

## 7. Worked example C — scheduled posts (two driving adapters, one service)

Posts show that **business rules are shared** across entry points.

### Ports

| Token | Job |
|-------|-----|
| `POST_REPOSITORY` | Load/save posts |
| `POST_ANALYTICS` | Ensure analytics row on create |
| `POST_SCHEDULER` | Enqueue “publish later” |
| `HTML_RENDERER` | Markdown → HTML |

```1:6:apps/api/src/modules/posts/application/ports/post-scheduler.port.ts
export const POST_SCHEDULER = Symbol('POST_SCHEDULER');
export const POST_SCHEDULER_QUEUE = 'post-scheduler';

export interface PostSchedulerPort {
  schedulePublish(postId: string, at: Date): Promise<void>;
}
```

### Two ways work enters

```text
  A) Editor hits POST /api/posts  (HTTP driving adapter)
        → PostsService.create
        → if SCHEDULED: POST_SCHEDULER.schedulePublish(...)

  B) Time arrives — BullMQ job   (queue driving adapter)
        → PostSchedulerConsumer
        → PostsService.publishScheduled
        → POST_REPOSITORY updates status to PUBLISHED
```

Wiring in `posts.module.ts`:

```26:33:apps/api/src/modules/posts/posts.module.ts
  providers: [
    PostsService,
    PostSchedulerConsumer,
    { provide: POST_REPOSITORY, useClass: TypeOrmPostRepository },
    { provide: POST_ANALYTICS, useClass: TypeOrmPostAnalyticsAdapter },
    { provide: POST_SCHEDULER, useClass: BullMqPostSchedulerAdapter },
    { provide: HTML_RENDERER, useClass: MarkedHtmlRendererAdapter },
  ],
```

**Why not call TypeORM from the consumer?**  
Then publish rules would exist twice (HTTP path + queue path). One application method owns “what published means”; both drivers call it.

**Why is `HTML_RENDERER` a port?**  
Markdown rendering uses `marked` today. Sanitization helpers live in `common/utils`. If you swapped to another renderer, the post use cases would still ask “give me HTML for this markdown.”

---

## 8. Cross-module boundaries (analytics does not import PostsModule)

A subtle design choice: the analytics feature needs to know “is this post published?” but it does **not** import `PostsModule`.

Instead it defines its own port:

```1:5:apps/api/src/modules/analytics/application/ports/published-post.port.ts
export const PUBLISHED_POST_LOOKUP = Symbol('PUBLISHED_POST_LOOKUP');

export interface PublishedPostLookupPort {
  existsPublished(postId: string): Promise<boolean>;
}
```

A TypeORM adapter in *analytics* infrastructure queries `PostEntity` directly.

**Why not inject `PostsService`?**

1. Avoids circular Nest module dependencies.
2. Analytics only needs a yes/no published check — not the whole posts API surface.
3. Keeps feature modules replaceable; analytics owns the narrow contract it needs.

You will also see `POST_ANALYTICS` inside the **posts** module (ensure a row when a post is created). That is a different concern: posts creating analytics rows vs analytics recording views/claps. Two ports, two owners — intentional, even if the names look related.

---

## 9. Domain vs entity (and what “pure” means here)

### Shared kernel

```1:14:apps/api/src/domain/user.model.ts
import { UserRole } from './user-role.enum';

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
  posts: unknown[];
  comments: unknown[];
  createdAt: Date;
  updatedAt: Date;
}
```

Enums like `UserRole` / `PostStatus` live here. Database files **re-export** them so TypeORM columns stay aligned without duplicating enum values.

### Honesty about impurities

PCMS is pragmatic, not textbook DDD:

| Pragmatic choice | Why |
|------------------|-----|
| Application uses Nest exceptions | Fits Nest error filters; still no I/O libs in application |
| One `*Service` per feature (not one class per use case) | Matches Nest habits; enough for this codebase size |
| `User.posts` / `User.comments` as `unknown[]` | Reflects ORM relations without pulling entities into domain |
| Health module skips a full application service | Health is plumbing; Redis is ported, DB uses Terminus directly |
| Controllers sometimes type roles via entity enums | Existing convenience; prefer domain enums for new code |

Read [11 — Current gaps](../11-current-gaps.md) before assuming every feature is complete (e.g. S3 adapter, comments module, 2FA HTTP route).

---

## 10. Port → adapter map (cheat sheet)

| Feature | Token | Interface | Adapter today |
|---------|-------|-----------|---------------|
| auth | `USER_REPOSITORY` | `UserRepositoryPort` | `TypeOrmUserRepository` |
| auth | `PASSWORD_HASHER` | `PasswordHasherPort` | `BcryptPasswordHasherAdapter` |
| auth | `TOKEN_SERVICE` | `TokenServicePort` | `JwtTokenAdapter` |
| posts | `POST_REPOSITORY` | `PostRepositoryPort` | `TypeOrmPostRepository` |
| posts | `POST_SCHEDULER` | `PostSchedulerPort` | `BullMqPostSchedulerAdapter` |
| posts | `POST_ANALYTICS` | `PostAnalyticsPort` | `TypeOrmPostAnalyticsAdapter` |
| posts | `HTML_RENDERER` | `HtmlRendererPort` | `MarkedHtmlRendererAdapter` |
| media | `MEDIA_REPOSITORY` | `MediaRepositoryPort` | `TypeOrmMediaRepository` |
| media | `IMAGE_PROCESSOR` | `ImageProcessorPort` | `SharpImageProcessorAdapter` |
| media | `FILE_STORAGE` | `FileStoragePort` | `LocalFileStorageAdapter` |
| analytics | `ANALYTICS_REPOSITORY` | `AnalyticsRepositoryPort` | `TypeOrmAnalyticsRepository` |
| analytics | `PUBLISHED_POST_LOOKUP` | `PublishedPostLookupPort` | `TypeOrmPublishedPostAdapter` |
| health | `CACHE_HEALTH` | `CacheHealthPort` | `IoRedisCacheHealthAdapter` |

Driving adapters (not in the table): HTTP controllers in each feature; `PostSchedulerConsumer` for delayed publish; Passport `JwtStrategy` (uses `USER_REPOSITORY` after decoding a token).

---

## 11. How testing leans on hexagonal design

Because `AuthService` depends on ports, tests construct it with mocks — no Postgres, no bcrypt cost, no JWT secrets:

```35:64:apps/api/src/modules/auth/application/auth.service.spec.ts
  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('token'),
      signRefreshToken: jest.fn().mockResolvedValue('token'),
      verifyRefreshToken: jest.fn(),
    };
    service = new AuthService(users, passwordHasher, tokenService);
  });

  it('registers a new user', async () => {
    users.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed');
    users.create.mockResolvedValue(user);
    const result = await service.register({
      email: 'A@B.com',
      password: 'password1',
    });
    expect(result.user.email).toBe('a@b.com');
    expect(result.tokens.accessToken).toBe('token');
  });
```

| Layer under test | What you mock |
|------------------|---------------|
| Application service | Port interfaces |
| Driven adapter | TypeORM `Repository`, BullMQ `Queue`, `fs`, Sharp, … |
| Controller | Application service |

Coverage excludes `*.port.ts`, `*.model.ts`, and `src/domain/**` (types only). Full testing tutorial: [10 — Testing](../10-testing.md).

**Why this is a design win:** if application imported TypeORM, every rule test would need an in-memory DB or heavy Nest testing module. Ports make “prove register rejects duplicates” a 10-line unit test.

---

## 12. Tutorial exercise — add a capability the PCMS way

Imagine you need: “email the author when a post is published.”

Do **not** put Nodemailer inside `PostsService`. Follow the checklist:

1. **Domain / types** — optional plain type for email payload if useful.
2. **Port** — e.g. `application/ports/post-notifier.port.ts`:
   ```typescript
   export const POST_NOTIFIER = Symbol('POST_NOTIFIER');
   export interface PostNotifierPort {
     notifyPublished(postId: string, authorEmail: string): Promise<void>;
   }
   ```
3. **Application** — in `PostsService.publish` / `publishScheduled`, after status flip, call `this.notifier.notifyPublished(...)`.
4. **Driven adapter** — `infrastructure/messaging/smtp-post-notifier.adapter.ts` (or a no-op / log adapter for local).
5. **Composition root** — in `posts.module.ts`:
   ```typescript
   { provide: POST_NOTIFIER, useClass: SmtpPostNotifierAdapter },
   ```
6. **Tests** — mock `POST_NOTIFIER` in the service spec; mock the mail client in the adapter spec.
7. **Controller stays thin** — no mail logic in HTTP.

Success criteria: `PostsService` still has zero imports of Nodemailer/`fs`/TypeORM.

---

## 13. Common mistakes (and how to catch them)

| Mistake | Smell | Fix |
|---------|-------|-----|
| Application imports TypeORM / bcrypt / Sharp | Import from a library in `application/` | Move call behind a port + adapter |
| Fat controller with business rules | Controllers hashing passwords or building slugs | Move rules into `*Service` |
| String DI tokens | `"USER_REPOSITORY"` scattered | Use colocated `Symbol` |
| Domain model = TypeORM entity | Decorators in `domain/` | Keep entities in `database/entities/`; map |
| Feature A imports Feature B’s module for one field | Circular deps / fat coupling | Narrow port owned by A (see analytics) |
| “I’ll just `useClass` in the service” | Hard-coded `new TypeOrm…` | Inject via `@Inject(TOKEN)` |

Agent rule of thumb (also in `.cursor/rules/nestjs-api.mdc`): *dependency rule is non-negotiable; Nest pragmatism is allowed only where documented.*

---

## 14. What to read next

| Goal | Doc |
|------|-----|
| Short architecture sketch | [01 — Overview](../01-overview-and-architecture.md) |
| Every route and module map | [05 — API deep dive](./05-api-deep-dive.md) |
| Guards, filters, interceptors | [06 — API common layer](./06-api-common-layer.md) |
| Login / publish / clap stories | [08 — Request flows](../08-request-flows.md) |
| Mock ports in Jest | [10 — Testing](../10-testing.md) |
| What is stubbed (S3, comments, …) | [11 — Current gaps](../11-current-gaps.md) |

---

## 15. One-paragraph recap

PCMS puts **rules in application services**, **data shapes in domain**, and **I/O in adapters**. Ports are TypeScript interfaces plus Symbol tokens; Nest modules bind tokens to adapters. Controllers and queue consumers drive the app; TypeORM, bcrypt, BullMQ, Sharp, and disk are driven by it. That is why you can unit-test auth without Postgres, and why swapping local uploads for S3 is a module binding change — not a rewrite of `MediaService`.
