# 06 — API common layer

Path: `apps/api/src/common/`

This folder holds **cross-cutting** pieces used by every module. If you understand these, Nest “magic” becomes predictable.

---

## Decorators

### `@Public()`

File: `decorators/public.decorator.ts`

Sets metadata `IS_PUBLIC_KEY = true` on a handler/class.

`JwtAuthGuard` reads that metadata with Nest’s `Reflector`. If public → skip JWT.

Used on: auth routes, public posts, public analytics, health.

### `@Roles(...roles)`

File: `decorators/roles.decorator.ts`

Stores required roles on the route. `RolesGuard` compares `request.user.role` against the list.

Example:

```typescript
@Roles(UserRole.ADMIN, UserRole.EDITOR)
@Post()
create(...) {}
```

### `@CurrentUser()`

File: `decorators/current-user.decorator.ts`

Param decorator that pulls `request.user` (the UserEntity attached by JWT strategy).

Used when creating posts so the author is the logged-in user.

---

## Guards

### `JwtAuthGuard`

Extends Passport `AuthGuard('jwt')`.

Flow:

1. Is route `@Public`? → allow
2. Else run Passport JWT validation
3. `handleRequest`: if no user → `UnauthorizedException('Authentication required')`

Registered globally via `APP_GUARD` in `AppModule`.

### `RolesGuard`

1. Read `@Roles` metadata
2. If no roles required → allow
3. If user missing or role not in list → `ForbiddenException`

Also global `APP_GUARD`.

### `ThrottlerGuard`

From `@nestjs/throttler`, also global. Enforces default 100/min and per-route `@Throttle` overrides.

**Guard order:** Nest runs APP_GUARD providers in registration order: Throttler → JwtAuth → Roles (as listed in `app.module.ts`).

---

## Interceptor: `TransformInterceptor`

Wraps every successful controller result:

```typescript
{ success: true, data: <result> }
```

Why it matters for the web: `apiFetch` always expects this envelope and returns only `data`.

---

## Filter: `HttpExceptionFilter`

Catches Nest `HttpException`s (and related) and returns a consistent error JSON body including:

- `success: false`
- `statusCode`
- `message` (string or array from validation)
- `error`
- `timestamp`
- `path`

Registered globally via `APP_FILTER`.

---

## Utils: `content.util.ts`

| Function | Behavior |
|----------|----------|
| `sanitizeHtml(dirty)` | DOMPurify with HTML profile |
| `slugify(input)` | lowercase, strip junk, hyphenate |
| `estimateReadingTime(content)` | words/200, min 1 |

Used heavily by `PostsService`.

---

## Empty placeholders

These folders exist for future expansion:

- `common/dto/`
- `common/pipes/`

Nothing required lives there yet.

---

## Mental model

```text
Request
  → ThrottlerGuard      (too many requests?)
  → JwtAuthGuard        (who are you? or @Public)
  → RolesGuard          (are you allowed?)
  → ValidationPipe      (is the body shape valid?)
  → Controller
  → Service
  → Repository / Queue / FS
Response success → TransformInterceptor
Response error   → HttpExceptionFilter
```

---

## Next

- [07 — Web deep dive](../web/07-web-deep-dive.md)
