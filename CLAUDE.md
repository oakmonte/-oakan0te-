# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Oakmonte — a content-driven fashion marketplace ("an ecosystem for vetted sellers, honest creators and
style curators"). TanStack Start (React 19, file-based routing) app built and maintained through
[Lovable](https://lovable.dev). Deployed to Cloudflare (Nitro `cloudflare` preset).

> [!IMPORTANT]
> This repo is connected to Lovable. Avoid rewriting published git history (force push, rebase/amend/squash
> of already-pushed commits) — it desyncs Lovable's editor from this branch. Commits pushed to the connected
> branch sync back into the Lovable editor, so keep the branch in a working state.

## Commands

Package manager is **bun** (`bun.lock` is canonical; `package-lock.json` also present — prefer bun).

- `bun run dev` — start dev server (vite dev)
- `bun run build` — production build
- `bun run build:dev` — development-mode build
- `bun run preview` — preview a production build
- `bun run lint` — ESLint over the whole repo
- `bun run format` — Prettier write over the whole repo

There is no test runner configured in this repo currently.

## Architecture

### Routing

File-based routing via TanStack Router, rooted at `src/routes/`. Read `src/routes/README.md` before adding
routes — key conventions:

- Every `.tsx`/`.ts` file in `src/routes/` becomes a route; there is no `src/pages/` or Next/Remix-style
  `app/` directory.
- `index.tsx` → `/`, `users/$id.tsx` → `/users/:id` (dynamic), `files/$.tsx` → splat (`_splat` param).
- `__root.tsx` is the only root layout (app shell, `<Outlet />`, head tags, global error/not-found boundaries).
- `routeTree.gen.ts` is generated — never hand-edit it.
- Dotted filenames (`store.products.tsx`, `create.after-shot.edit.tsx`) express nested paths flatly;
  `store.products_.new.tsx`'s trailing underscore before the dot opts that segment out of the `store`
  parent layout.
- API routes are just route files with a `server.handlers` export (see `src/routes/api.*.ts`), e.g.
  `src/routes/api.shopify.callback.tsx` handles `GET /api/shopify/callback`.

### Two Supabase integrations — do not conflate them

There are **two separate Supabase clients** wired into the app simultaneously (both registered as
`functionMiddleware` in `src/start.ts`):

1. **`src/integrations/supabase/*`** and its byte-identical duplicate **`src/lib/integrations/supabase/*`**
   — Lovable Cloud's auto-managed Supabase integration. Files are headed "automatically generated, do not
   edit directly" and read `VITE_SUPABASE_URL`/`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` from env.
2. **`src/lib/integrations/my-supabase/*`** — the app's own external Supabase project, config hardcoded in
   `config.ts` (`MY_SUPABASE_URL`, `MY_SUPABASE_PUBLISHABLE_KEY`; service-role key from
   `process.env.SUPABASE_SERVICE_ROLE_KEY` server-side). **This is the one actually used throughout app
   code** — auth (`src/lib/auth.ts`), session state (`src/hooks/use-session.ts`), every `store.*`/product
   route, and both external-integration API routes (Shopify, Bumpa) all import from `my-supabase`.

When adding a data-fetching or auth feature, import from `@/lib/integrations/my-supabase/client` (browser,
RLS-scoped) or `@/lib/integrations/my-supabase/client.server` (`supabaseAdmin`, service-role, server-only —
bypasses RLS, only for trusted server code). Regenerated types live at
`src/integrations/supabase/types.ts` / `src/lib/integrations/supabase/types.ts`; there's no separate
generated types file for `my-supabase`.

`*.server.ts` modules (not the Next.js `server-only` package — ESLint blocks importing that) are the
TanStack Start convention for server-only code; route files and `*.functions.ts` ship to the client bundle,
so load `client.server.ts` inside server handlers via dynamic `import()`, not a top-level import, unless
you're already inside another `.server.ts` module.

### SSR error handling (layered, deliberately redundant)

Three cooperating layers exist because h3 (Nitro's HTTP layer) can swallow an in-handler `throw` into a
generic `{"unhandled":true,"message":"HTTPError"}` 500 JSON body that a plain `try/catch` never sees:

- `src/lib/error-capture.ts` — installs global `error`/`unhandledrejection` listeners that stash the last
  real error (5s TTL) so it can be recovered out-of-band.
- `src/server.ts` — the Cloudflare Worker `fetch` entry. Wraps the real TanStack server entry, and after a
  response comes back, detects the h3-swallowed-500 shape and replaces it with a rendered error page,
  pulling the real error out of `error-capture` for logging.
- `src/start.ts` — registers `errorMiddleware` (request-level, re-renders 500s as HTML) plus both Supabase
  auth attachers as `functionMiddleware`.
- `src/routes/__root.tsx` — client-side `errorComponent`, forwards to `reportLovableError`
  (`src/lib/lovable-error-reporting.ts`), which talks to `window.__lovableEvents`/`__lovableReportRuntimeError`
  — hooks only present inside the Lovable editor preview, no-ops elsewhere.

Don't "simplify" this by collapsing layers — each exists for a distinct failure mode (build-time render
error vs. h3-swallowed throw vs. client-side render error).

### Camera / capture / after-shot editing pipeline

`src/routes/create.tsx` → `create.after-shot.tsx` (layout) → `create.after-shot.index.tsx` /
`.edit.tsx` / `.filters.tsx` is a multi-step post-capture editing flow (crop/draw/text/filters/layout),
backed by `src/components/camera/*` and `src/components/camera/aftershot/*`.

Handoff from the camera route to the edit route is an **in-memory module variable**
(`src/lib/capture-handoff.ts`), not sessionStorage/localStorage — captured media is a `Blob`, and since
TanStack Router client-side navigation never reloads the page, a plain module-level variable survives the
transition. Known consequence: a hard refresh on `/create/after-shot/edit` loses the pending capture and
falls back to `/create`. `src/lib/after-shot-context.ts` provides the React context consumed by the edit
sub-routes. Related media utilities: `src/lib/crop-media.ts`, `src/lib/filter-media.ts`,
`src/lib/video-trim.ts`, `src/lib/layer-bake.ts`, `src/lib/canvas-filter.ts`, `src/lib/after-shot-layers.ts`.

### Seller / store product flow

`src/routes/store.tsx` is the seller dashboard shell (nav: Home/Orders/Products/Customers/Growth/
Discounts/Content/Finance), wrapping `store.*.tsx` child routes. Product creation/editing lives in
`store.products_.new.tsx` (opted out of the `store` layout — see routing note above) and
`store.products_.newcomer.tsx`, composed from `src/components/product-form/*` (sections for details,
pricing, inventory, media, variants, publishing, category/type pickers). Variant generation is handled by
`VariantMatrixBuilder.tsx`. Product category taxonomy is a large static tree in `src/lib/categories.ts`
(`CategoryNode`: omit `children` for a true leaf, `children: []` means "has children, not filled in yet").

### External store integrations (Shopify, Bumpa, Shipbubble)

Server-only API routes under `src/routes/api.*`:

- `api.shopify.install.tsx` / `api.shopify.callback.tsx` — OAuth install/callback; callback verifies
  Shopify's HMAC and a self-signed `storeId.signature` state param before exchanging the code and writing
  `store_credentials` via `supabaseAdmin`.
- `api.bumpa.connect.ts` — verifies a user-supplied Bumpa API key against Bumpa's API, then persists it.
- `api.shipbubble.ping.ts` — Shipbubble integration health check.

Secrets for these (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_REDIRECT_URI`,
`SUPABASE_SERVICE_ROLE_KEY`) live in `.env`, read via `process.env` server-side only.

### Auth flow

`src/lib/auth.ts` is the single source of truth for post-auth navigation
(`resolvePostAuthRedirect`): existing profile → `/profile/$username`; no profile but an entry-point intent
was recorded in `sessionStorage` (`oakmonte_intent`) → `/choose-username`; otherwise → `/no-account`.
Google OAuth and magic-link sign-in both redirect through `src/routes/auth.callback.tsx`.

## Conventions

- Path alias `@/*` → `src/*` (see `tsconfig.json`, `components.json`).
- UI components are shadcn/ui (`style: new-york`, Tailwind v4, no prefix) — generated components live in
  `src/components/ui/`; treat them as editable app code, not vendored files.
- Prettier: 100-char width, double quotes off (`singleQuote: false` → double quotes), trailing commas
  everywhere, semicolons on. Prettier violations are surfaced as ESLint errors (`eslint-plugin-prettier`).
- `bunfig.toml` enforces a 24h "supply-chain guard" (`minimumReleaseAge`) blocking freshly-published package
  versions; only `@lovable.dev/*` packages are excluded. Confirm with the user before adding new excludes.
- `vite.config.ts` is intentionally thin — `@lovable.dev/vite-tanstack-config` already wires TanStack
  devtools, `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, Nitro (Cloudflare preset), env
  injection, and the `@` alias. Don't re-add any of those plugins manually.
