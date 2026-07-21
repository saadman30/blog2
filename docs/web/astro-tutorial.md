# Astro tutorial — how `@pcms/web` works

This guide teaches **Astro through the PCMS codebase** (`apps/web`). By the end you should be able to:

1. Explain why PCMS uses Astro (static HTML + sparse React) instead of a full SPA framework
2. Trace a URL to a file under `src/pages/` and know when that page’s code runs
3. Read an `.astro` file (frontmatter → markup → scoped styles) and predict the built HTML
4. Decide when to use a React island (`client:load`) vs plain Astro/HTML
5. Understand static `output: 'static'`, `getStaticPaths`, and the current blog SSG gap
6. Follow data from the Nest API into a page (build-time fetch) or into an island (browser `apiFetch`)

If you only need a route/component map, use [07 — Web deep dive](./07-web-deep-dive.md). This doc is the **tutorial path**.

**Assumption:** you can run `npm run dev:web` from the repo root (port **4321**). The API on `:3001` is optional for most pages; blog index needs it unless `PUBLIC_DEMO_MODE=true`.

---

## 1. Mental model — what Astro is doing here

Astro’s default pitch matches PCMS:

> Ship **mostly HTML**. Hydrate **only** the bits that need interactivity.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  Browser request  →  static file from dist/ (or Astro dev server)           │
│                                                                            │
│  HTML for layout, copy, post body     →  no React runtime required         │
│  ThemeToggle / LoginForm / ClapButton →  small React islands hydrate later │
└────────────────────────────────────────────────────────────────────────────┘
```

In PCMS this is configured explicitly:

```5:12:apps/web/astro.config.mjs
export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'static',
```

| Setting | Meaning for PCMS |
|---------|------------------|
| `output: 'static'` | `astro build` writes HTML/JS/CSS to `dist/`. No Node server renders pages at request time in production. |
| `@astrojs/react` | Lets `.tsx` components live inside `.astro` pages and hydrate with `client:*` directives. |
| `@astrojs/tailwind` | Tailwind utility classes; `applyBaseStyles: false` so our `global.scss` owns the base layer. |

**Contrast with Next.js (intentionally not used):** there is no App Router, no server components tree, no per-request SSR in production. Interactive auth/write/clap logic runs in the **browser** after the static shell loads.

---

## 2. Project map — where Astro “lives”

```text
apps/web/
├── astro.config.mjs          # output mode, React + Tailwind, SCSS inject
├── public/                   # files copied as-is to dist/ (favicons, etc.)
├── src/
│   ├── pages/                # FILE = ROUTE (this is the router)
│   ├── layouts/              # shared HTML shells (.astro)
│   ├── components/           # .astro or .tsx (React islands)
│   ├── styles/               # global SCSS + tokens
│   ├── stores/               # nanostores (client state)
│   ├── utils/                # api-client, theme, content helpers
│   ├── env.d.ts              # PUBLIC_* env typings
│   └── instrumentation.mjs   # OTEL for Node during `astro dev` / preview
└── dist/                     # build output (gitignored)
```

Astro’s only routing rule you need day one:

> A file under `src/pages/` becomes a URL. Folders nest. `[param].astro` is dynamic.

| File | URL |
|------|-----|
| `pages/index.astro` | `/` |
| `pages/portfolio.astro` | `/portfolio` |
| `pages/blog/index.astro` | `/blog` |
| `pages/blog/[slug].astro` | `/blog/:slug` |
| `pages/blog/tag/[tag].astro` | `/blog/tag/:tag` |
| `pages/app/write.astro` | `/app/write` |

---

## 3. Anatomy of an `.astro` file

Every `.astro` file has up to three regions:

```text
---
  // 1. Frontmatter — TypeScript that runs at BUILD time
  //    (and also on each request in `astro dev`)
---

<!-- 2. Template — HTML + components + expressions -->

<style lang="scss">
  /* 3. Scoped styles — only apply to elements in THIS file
     (unless you use :global(...)) */
</style>
```

### Walkthrough: the home page

```1:20:apps/web/src/pages/index.astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { Button } from '../components/ui/button';
---

<BaseLayout title="PCMS — Portfolio & Writing" description="Engineering portfolio and long-form writing.">
  <section class="home-hero">
    <div class="home-hero__copy">
      <p class="home-hero__brand">PCMS</p>
      <h1>Build in public. Ship with clarity.</h1>
      ...
      <div class="home-hero__actions">
        <a href="/blog"><Button client:load>Read the blog</Button></a>
        <a href="/portfolio"><Button client:load variant="outline">View portfolio</Button></a>
      </div>
    </div>
  </section>
</BaseLayout>
```

What happens:

1. **Frontmatter** imports a layout and a React `Button`.
2. **Template** passes props into `BaseLayout` and fills its default `<slot />` with the hero.
3. `Button` is a React component — without `client:load` it would render to static HTML only (no click handlers). With `client:load`, Astro ships a small JS chunk so the button hydrates in the browser.
4. The `<style lang="scss">` block at the bottom styles `.home-hero` and is **scoped** to this page.

### The `---` fence is not “server components”

Frontmatter code runs in **Node** while Astro builds (or serves in dev). It does **not** stay connected to the browser. Anything you need after the user clicks must either:

- be baked into the HTML at build time, or
- live in a hydrated island that calls the API from the browser.

---

## 4. Layouts and slots — composing pages

Layouts are normal `.astro` components used as wrappers. PCMS has three:

```text
BaseLayout.astro     →  <html>, fonts, header, footer, theme boot script
   ↑
AppLayout.astro      →  BaseLayout + AuthHydrate island (back office)
BlogLayout.astro     →  BaseLayout + two-column article (aside + content)
```

### Default slot

`BaseLayout` renders page content via `<slot />`:

```30:42:apps/web/src/layouts/BaseLayout.astro
  <body>
    <header class="site-header">
      ...
    </header>
    <main>
      <slot />
    </main>
    <footer class="site-footer">
      <p>© {new Date().getFullYear()} PCMS</p>
    </footer>
  </body>
```

Whatever you put between `<BaseLayout>...</BaseLayout>` lands inside `<main>`.

### Named slots

`BlogLayout` exposes an `aside` slot for the table of contents:

```12:18:apps/web/src/layouts/BlogLayout.astro
<BaseLayout title={title} description={description}>
  <article class="blog-layout">
    <slot name="aside" />
    <div class="blog-layout__content">
      <slot />
    </div>
  </article>
</BaseLayout>
```

The post page fills it like this:

```astro
<Fragment slot="aside">
  <TableOfContents items={toc} />
</Fragment>
```

**Exercise:** open `/blog/welcome-to-pcms` and find the TOC in the aside on wide viewports — that markup came from the named slot, not from the main content slot.

### Props flow

Layouts declare `Astro.props` in frontmatter (see `BaseLayout`’s `title` / `description`). Pages pass them as attributes: `<BaseLayout title="Blog — PCMS">`.

---

## 5. Tutorial: follow one request end to end

### Goal

Understand what runs when you visit `http://localhost:4321/blog` with the API up.

### Step A — start the web app

```bash
npm run dev:web
```

In dev, Astro still executes page frontmatter on each request (handy for iterating on `fetch`). In production build, that same frontmatter ran **once** at `astro build` and the result was written to HTML.

### Step B — open the page file

`src/pages/blog/index.astro` does this in frontmatter:

1. Read `PUBLIC_API_URL` (default `http://localhost:3001/api`)
2. `await fetch(`${apiUrl}/posts`)`
3. Expect the API envelope `{ success: true, data: PostSummary[] }`
4. On failure: either demo posts (`PUBLIC_DEMO_MODE=true`) or an error alert + empty list

```35:52:apps/web/src/pages/blog/index.astro
try {
  const response = await fetch(`${apiUrl}/posts`);
  if (response.ok) {
    const payload = (await response.json()) as { success: true; data: PostSummary[] };
    posts = payload.data ?? [];
  } else if (demoMode) {
    posts = demoPosts;
  } else {
    loadError = `Could not load posts (HTTP ${response.status}).`;
  }
} catch {
  if (demoMode) {
    posts = demoPosts;
  } else {
    loadError =
      'Could not reach the API. Start the API server and rebuild, or set PUBLIC_DEMO_MODE=true for demo content.';
  }
}
```

### Step C — template turns data into HTML

The template maps `posts` to cards. Those cards are mostly **static HTML** in the response — React `Card` / `Badge` components are rendered to HTML on the server/build side; they are **not** marked `client:load`, so they do not ship a React runtime for the card grid.

### Step D — what the browser downloads

Roughly:

1. HTML document (already containing titles, summaries, links)
2. CSS (global + scoped)
3. Tiny island JS only for things like `ThemeToggle` in the header (`client:load` on `BaseLayout`)

The post list itself does **not** call `apiFetch` in the browser. If you need a live-updating admin table, that would be a different pattern (island + client fetch) — see gaps for `/app/posts`.

### Verify

| Check | Expected |
|-------|----------|
| API up, `PUBLIC_DEMO_MODE=false` | Cards from Nest `GET /api/posts` |
| API down, demo off | Error alert; empty grid |
| API down, `PUBLIC_DEMO_MODE=true` | One demo card (`welcome-to-pcms`) |

---

## 6. Dynamic routes and `getStaticPaths`

Static output cannot invent infinite URLs at runtime. For `[slug].astro` and `[tag].astro`, Astro asks you: **which paths should exist in `dist/`?**

You answer with `getStaticPaths()`.

### Blog post page (current PCMS behavior)

```9:29:apps/web/src/pages/blog/[slug].astro
export function getStaticPaths() {
  return [
    {
      params: { slug: 'welcome-to-pcms' },
      props: {
        post: {
          id: 'demo',
          title: 'Welcome to PCMS',
          slug: 'welcome-to-pcms',
          content: '...',
          ...
          html: '<h2 id="why-pcms">...</h2>...',
        },
      },
    },
  ];
}
```

| Piece | Role |
|-------|------|
| `params.slug` | Becomes the URL segment → `/blog/welcome-to-pcms` |
| `props.post` | Available as `Astro.props` in the page — no second fetch needed |
| Only one path returned | Only that slug is prerendered; other slugs **404** in a static build |

Inside the page:

```ts
const { post } = Astro.props;
const toc = buildTableOfContents(post.content);
```

Then the template injects sanitized HTML with `set:html={post.html}` and mounts islands for clap / copy.

### Tag pages

```4:6:apps/web/src/pages/blog/tag/[tag].astro
export function getStaticPaths() {
  return [{ params: { tag: 'meta' } }, { params: { tag: 'engineering' } }];
}
```

Only `/blog/tag/meta` and `/blog/tag/engineering` exist. The UI is a stub; it does not yet list posts from `GET /api/posts?tag=...`.

### How you would wire real SSG (not done yet)

A complete static blog would look like:

```ts
export async function getStaticPaths() {
  const apiUrl = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const res = await fetch(`${apiUrl}/posts`);
  const { data: posts } = await res.json();
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}
```

Until that exists, **index can show API posts whose detail pages are not generated**. That mismatch is documented in [11 — Current gaps](../11-current-gaps.md).

---

## 7. React islands — when and how PCMS hydrates

### The rule of thumb used in this repo

| Need | Pattern |
|------|---------|
| Layout, typography, links, article HTML | `.astro` / static React render (no `client:*`) |
| Click handlers, forms, localStorage, live API calls | `.tsx` + `client:load` |

### Directives you will see

PCMS consistently uses **`client:load`**: hydrate as soon as the page loads.

Other Astro directives exist (`client:idle`, `client:visible`, `client:only`) but are not the house style here — prefer matching existing pages.

### Island catalog (real files)

| Island | Mounted from | Why it must be client |
|--------|--------------|------------------------|
| `ThemeToggle` | `BaseLayout` | Reads/writes theme; toggles `.dark` |
| `AuthHydrate` | `AppLayout` / `/app` | Restores session from `sessionStorage` |
| `LoginForm` | `/app` | POSTs login; updates auth store |
| `WriteForm` | `/app/write` | Authenticated `POST /posts` |
| `ClapButton` | `[slug].astro` | `POST /analytics/:id/clap` |
| `CopyCodeButton` | `[slug].astro` | `navigator.clipboard` |
| `TableOfContents` | `[slug].astro` | Client nav within the page (rendered as island) |
| `Button` (home CTAs) | `index.astro` | Hydrated shadcn button |

### Walkthrough: clap button

Static HTML can show “Clap · 0”. Updating the count after a click needs JS + `fetch`:

```10:34:apps/web/src/components/ClapButton.tsx
export function ClapButton({ postId, initialClaps = 0 }: ClapButtonProps) {
  const [claps, setClaps] = useState(initialClaps);
  ...
  async function handleClap() {
    ...
    const result = await apiFetch<{ claps: number }>(`/analytics/${postId}/clap`, {
      method: 'POST',
      body: JSON.stringify({ count: 1 }),
    });
    setClaps(result.claps);
  }
```

Mounted as:

```astro
<ClapButton client:load postId={post.id} initialClaps={0} />
```

Props (`postId`, `initialClaps`) are serialized from the Astro page into the island. The island then talks to the API **from the browser** via `apiFetch`.

### Walkthrough: theme without flash

Hydration is asynchronous. If the React toggle were the *only* place theme applied, users would see a light flash then dark. PCMS avoids that with two layers:

1. **Inline boot script** in `<head>` (`buildThemeBootScript()` + `is:inline`) runs before paint
2. **`ThemeToggle` island** keeps UI in sync after hydrate

```28:28:apps/web/src/layouts/BaseLayout.astro
    <script is:inline set:html={themeBootScript} />
```

`is:inline` means Astro leaves the script in the HTML as-is (not bundled/deferred away from first paint).

---

## 8. Client data layer — islands talking to Nest

Astro does not provide a built-in data library. PCMS uses:

| Piece | File | Role |
|-------|------|------|
| HTTP helper | `utils/api-client.ts` | `apiFetch`, refresh-on-401, unwrap `{ data }` |
| Auth state | `stores/auth-store.ts` | nanostores atom + `sessionStorage` |
| Trace headers | `utils/trace-headers.ts` | OTEL correlation on browser fetches |

### `PUBLIC_` env vars

Only variables prefixed with `PUBLIC_` are exposed to client-side code (and typed in `src/env.d.ts`):

```ts
import.meta.env.PUBLIC_API_URL
import.meta.env.PUBLIC_DEMO_MODE
```

Server-only secrets must **not** use the `PUBLIC_` prefix (and must not be imported into islands).

### Auth hydrate pattern

`AuthHydrate` is a null-render island whose only job is to run on mount:

```1:9:apps/web/src/components/backoffice/AuthHydrate.tsx
export function AuthHydrate() {
  useEffect(() => {
    hydrateAuth();
  }, []);
  return null;
}
```

`/app/write` wraps content in `AppLayout`, which always mounts this island so `WriteForm` can read `authStore` after a refresh.

**Security note:** there is no Astro middleware guarding `/app/*`. Anyone can load the HTML. Protection is on the API (`JwtAuthGuard` / roles) when `WriteForm` calls `POST /posts`.

---

## 9. Styling in an Astro app

PCMS stacks three layers (see deep dive for tokens). Astro-specific bits:

### Scoped page styles

```astro
<style lang="scss">
  .blog-index { ... }   /* becomes something like .blog-index[data-astro-xxx] */
</style>
```

Child HTML from `set:html` or deeply nested components may need `:global(...)` — the post page does this for rendered headings and `.toc`.

### SCSS auto-import

`astro.config.mjs` injects variables/mixins into every SCSS file via Vite:

```18:25:apps/web/astro.config.mjs
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: ['src/styles'],
          additionalData: `@import "variables"; @import "mixins";\n`,
        },
      },
    },
  },
```

That is why page styles can call `@include stack(...)` and `$space-md` without importing them manually.

### React + Tailwind

Islands use Tailwind utility classes (`className="space-y-3"`) and shadcn primitives under `components/ui/`. Astro pages often mix BEM-ish SCSS for layout with Tailwind-based UI components for controls.

---

## 10. Dev vs build vs preview

| Command | What runs |
|---------|-----------|
| `npm run dev:web` | Astro Vite dev server; frontmatter re-runs on request; OTEL via `instrumentation.mjs` |
| `npm run build -w @pcms/web` | Prerenders all static paths → `apps/web/dist/` |
| `npm run preview -w @pcms/web` | Serves `dist/` locally (closer to production) |

Docker serves the built `dist` with a static file server on port 4321.

### Implications of `output: 'static'`

1. **Build-time fetch** on `/blog` freezes whatever the API returned *at build time* into HTML until the next build.
2. **New post slugs** need `getStaticPaths` (or a rebuild pipeline) or detail URLs 404.
3. **Per-user HTML** is not a thing — personalization belongs in islands (auth store, client fetch).

In `astro dev`, rebuild-on-request makes the blog index feel “live.” Do not assume production behaves the same without a rebuild or a future `output: 'server'` / hybrid adapter (not used today).

---

## 11. Mini exercises (do these in the repo)

### Exercise 1 — Add a static page

1. Create `src/pages/about.astro`
2. Import `BaseLayout`, add a heading
3. Visit `http://localhost:4321/about`

**Verify:** no React required; view-source shows your heading in raw HTML.

### Exercise 2 — Pass a prop through a layout

1. Add an optional `eyebrow` prop to `BaseLayout` (or a local layout)
2. Render it above `<slot />`
3. Set it from a page

**Verify:** prop only exists in frontmatter/`Astro.props` — it is not magical global state.

### Exercise 3 — Make a tiny island

1. Create `src/components/HelloCounter.tsx` with `useState`
2. Mount it on the home page with `client:load`
3. Click and confirm the count updates

**Verify:** without `client:load`, clicks do nothing (static HTML only).

### Exercise 4 — Extend `getStaticPaths`

1. Add a second slug object next to `welcome-to-pcms` in `[slug].astro`
2. `astro build` and check `dist/blog/<your-slug>/index.html` exists

**Verify:** you understand why the API alone cannot create that file yet.

---

## 12. How this fits the rest of PCMS

```text
┌─────────────┐   build-time fetch          ┌──────────────┐
│  Astro page │ ──────────────────────────► │ Nest /api    │
│  .astro     │   (blog index frontmatter)  │  posts, etc. │
└──────┬──────┘                             └──────▲───────┘
       │ static HTML                               │
       ▼                                           │
┌─────────────┐   browser apiFetch + cookies       │
│ React island│ ───────────────────────────────────┘
│ client:load │
└─────────────┘
```

| Concern | Doc |
|---------|-----|
| Route & folder reference | [07 — Web deep dive](./07-web-deep-dive.md) |
| Login / publish / clap sequences | [08 — Request flows](../08-request-flows.md) |
| What is stubbed (SSG, tag pages, admin tables) | [11 — Current gaps](../11-current-gaps.md) |
| Vitest for utils/islands | [10 — Testing](../10-testing.md) |
| Web OTEL in dev/preview | [Observability](../observability/README.md) |

---

## 13. Cheat sheet

| Concept | In PCMS |
|---------|---------|
| Router | `src/pages/**/*.astro` |
| HTML shell | `layouts/*.astro` + `<slot />` |
| Build mode | `output: 'static'` → `dist/` |
| Dynamic URL | `[param].astro` + `getStaticPaths()` |
| Interactivity | React `.tsx` + `client:load` |
| Env in browser | `PUBLIC_*` via `import.meta.env` |
| API from island | `apiFetch` + `credentials: 'include'` |
| API at build | bare `fetch` in frontmatter |
| Styles | scoped `<style lang="scss">` + Tailwind in islands |
| Auth UI state | nanostores + `AuthHydrate` |

You do not need to memorize Astro’s entire API surface to work in this repo. If you can read a page’s frontmatter, see whether a component is an island, and know whether data was fetched at build time or in the browser, you can navigate and extend `@pcms/web` confidently.
