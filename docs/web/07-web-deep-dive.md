# 07 — Web deep dive (`apps/web`)

Package name: **`@pcms/web`**

This is an **Astro 5** site with **React 19 islands**, **not** Next.js.

Config highlights (`astro.config.mjs`):

- Integrations: `@astrojs/react`, `@astrojs/tailwind` (`applyBaseStyles: false`)
- `output: 'static'` — build produces static HTML/JS/CSS in `dist/`
- Dev server port **4321**, `host: true`
- Vite SCSS: auto-injects `@import "variables"; @import "mixins";` into every SCSS file

---

## Folder map

```text
apps/web/
├── astro.config.mjs
├── tailwind.config.mjs
├── components.json          # shadcn-style config
├── vitest.config.ts
├── tsconfig.json            # paths: @/* → src/*
├── public/
├── tests/                   # Vitest suites
└── src/
    ├── env.d.ts             # PUBLIC_API_URL, PUBLIC_DEMO_MODE typing
    ├── layouts/
    │   ├── BaseLayout.astro
    │   ├── AppLayout.astro  # back-office shell + AuthHydrate
    │   └── BlogLayout.astro
    ├── pages/               # = routes
    ├── components/
    │   ├── ui/              # shadcn primitives
    │   ├── backoffice/      # LoginForm, WriteForm, AuthHydrate
    │   └── *.tsx            # ThemeToggle, ClapButton, TOC, CopyCode
    ├── stores/
    │   └── auth-store.ts
    ├── styles/
    │   ├── global.scss
    │   ├── _variables.scss
    │   └── _mixins.scss
    └── utils/
        ├── api-client.ts
        ├── cn.ts
        ├── content.ts
        └── theme.ts
```

---

## Routing map (file → URL)

Astro maps files under `src/pages` to URLs.

| URL | File | What you see |
|-----|------|----------------|
| `/` | `pages/index.astro` | Home / brand hero + links |
| `/portfolio` | `pages/portfolio.astro` | Static project cards |
| `/blog` | `pages/blog/index.astro` | Post cards from API; error alert if fetch fails (demo only when `PUBLIC_DEMO_MODE=true`) |
| `/blog/:slug` | `pages/blog/[slug].astro` | Post body + TOC + tools |
| `/blog/tag/:tag` | `pages/blog/tag/[tag].astro` | Tag listing stubs |
| `/app` | `pages/app/index.astro` | Back office home + login |
| `/app/write` | `pages/app/write.astro` | Create post form |
| `/app/posts` | `pages/app/posts.astro` | Preview — admin table not wired |
| `/app/media` | `pages/app/media.astro` | Preview — upload UI not wired |
| `/app/settings` | `pages/app/settings.astro` | Preview — settings forms not wired |

There is **no** `/app/insights` page in this codebase.

---

## Layouts

### `BaseLayout.astro`

Site chrome:

- HTML shell
- Google fonts (Source Sans 3 + Fraunces — also mirrored in Tailwind config)
- Global SCSS import
- Inline script from `buildThemeBootScript()` in `utils/theme.ts` (avoids theme flash; single source of truth with toggle helpers)
- Header nav + footer
- Slot for page content
- `ThemeToggle` React island

### `AppLayout.astro`

Back-office wrapper around `BaseLayout`:

- Mounts `AuthHydrate` (`client:load`) to call `hydrateAuth()` on page load
- Shared `.admin-page` styles for `/app/posts`, `/app/media`, `/app/settings`, `/app/write`

### `BlogLayout.astro`

Extends the base idea with a two-column grid:

- `aside` slot (table of contents)
- main content slot

---

## How a page loads data

### Blog index (`/blog`)

In frontmatter (runs at build time / request time in `astro dev`):

1. Read `PUBLIC_API_URL`
2. `fetch(`${apiUrl}/posts`)`
3. Expect `{ success: true, data: PostSummary[] }`
4. On network/HTTP failure:
   - If `PUBLIC_DEMO_MODE=true` → inject a demo post so builds succeed offline
   - Otherwise → show an error alert; post list stays empty

Cards link to `/blog/${slug}` and tag badges to `/blog/tag/${tag}`.

### Blog post (`/blog/[slug]`)

Uses Astro `getStaticPaths()` with **one hardcoded path**: `welcome-to-pcms`.

Props include markdown `content` and prebuilt `html`.

That means:

- New posts created via API **will appear on `/blog` index** (if fetch works)
- But opening `/blog/your-new-slug` **will 404 in static build** until `getStaticPaths` is wired to fetch published posts from the API

This is an important current limitation — see [11 — gaps](../11-current-gaps.md).

---

## React islands (interactive pieces)

Astro ships HTML first. Components marked `client:load` hydrate in the browser.

| Component | Role |
|-----------|------|
| `ThemeToggle` | Toggle light/dark; persists `pcms-theme` in localStorage |
| `TableOfContents` | Renders heading links from `buildTableOfContents(markdown)` |
| `ClapButton` | Shows clap count; `POST /analytics/:postId/clap` (keeps last count on API error) |
| `CopyCodeButton` | Copies a code string to clipboard |
| `LoginForm` | `POST /auth/login` → `setAuth` |
| `WriteForm` | `POST /posts` with Bearer token |

### LoginForm flow

1. Submit email/password
2. `apiFetch('/auth/login', { method: 'POST', body })`
3. On success, `setAuth(user, accessToken)`
4. Token lands in nanostore + sessionStorage

### WriteForm flow

1. Read `authStore.get().accessToken`
2. If missing → show “Authentication required”
3. Else `apiFetch('/posts', { method:'POST', body: { title, content, status, scheduledAt? } }, token)`
4. Show success/error message

Statuses supported in the form UI: `DRAFT | SCHEDULED | PUBLISHED`.

---

## API client

File: `utils/api-client.ts`

```text
getApiBaseUrl() → PUBLIC_API_URL or http://localhost:3001/api
apiFetch(path, init?, accessToken?)
  → fetch(base + path, { credentials: 'include', headers... })
  → on 401 (once): POST /auth/refresh, update auth store, retry
  → unwrap payload.data
  → or throw ApiClientError
```

Why `credentials: 'include'`? So the browser will send/store the refresh cookie for `/api/auth/*`.

`ApiClientError` carries `statusCode` and optional error body.

---

## Auth store (nanostores)

Not Zustand. One atom:

```text
{ accessToken: string | null, user: { id, email, role } | null }
```

SSR-safe: `getSessionStorage()` returns `null` when `window` is missing.

---

## UI system (shadcn-style)

`components.json` points aliases at `@/components`, `@/utils`, `@/components/ui`.

Primitives:

- `button.tsx` — CVA variants
- `badge.tsx`
- `card.tsx` — compound Card/Header/Title/Description/Content
- `input.tsx`
- `dialog.tsx` — Radix dialog

`cn()` (`utils/cn.ts`) merges Tailwind classes with `clsx` + `tailwind-merge`.

There is **no** atoms/molecules/organisms folder structure in this app.

---

## Styling system (three layers)

### 1. Global CSS variables + Tailwind

`styles/global.scss`:

- `@tailwind` base/components/utilities
- `:root` and `.dark` HSL design tokens (shadcn pattern)
- Hero background gradient variables
- Base body styles

`tailwind.config.mjs`:

- `darkMode: ['class']`
- Color tokens map to `hsl(var(--...))`
- Fonts: Source Sans 3 (sans), Fraunces (display)
- Plugin: `tailwindcss-animate`

### 2. SCSS design tokens / mixins

`_variables.scss` — ink/paper/accent colors, spacing scale, breakpoints, font vars  
`_mixins.scss` — `respond-up`, `theme-surface`, `stack`

Auto-imported into every SCSS via Astro Vite config.

### 3. Astro scoped `<style lang="scss">`

Page-local BEM-ish classes (e.g. `.blog-index__grid`) without CSS Modules files.

---

## Content helpers (`utils/content.ts`)

Used by blog pages:

- `formatDate`
- `buildTableOfContents` — parse markdown headings into TOC items
- reading-time style helpers covered by tests

Theme helpers (`utils/theme.ts`) read/write class + localStorage. `buildThemeBootScript()` generates the inline `<head>` script used by `BaseLayout`.

---

## Back office maturity

| Page | Status |
|------|--------|
| `/app` login | Working against API; session hydrates on load |
| `/app/write` | Working create against API |
| `/app/posts` | Preview copy (nav labeled “preview”) |
| `/app/media` | Preview copy (API upload exists) |
| `/app/settings` | Preview copy |

No client-side route guard; security is enforced by the API when you call protected endpoints.

---

## Build & preview

```bash
npm run build -w @pcms/web   # → dist/
npm run preview -w @pcms/web
```

Docker serves `dist` with `serve -s dist -l 4321`.

Because output is static, anything that must vary per request at runtime (unless client-fetched) must be decided at **build** time.

---

## Next

- Learn Astro via this codebase: [Astro tutorial](./astro-tutorial.md)
- Walkthroughs: [08 — Request flows](../08-request-flows.md)
- Infra: [09 — Docker](../09-docker-and-infrastructure.md)
