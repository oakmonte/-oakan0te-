# CLAUDE.md

Oakmonte — content-driven fashion marketplace. TanStack Start (React 19, file-based routing),
Tailwind v4, deployed to Cloudflare (Nitro `cloudflare` preset), built/maintained through Lovable.
Product is a mobile-first **webapp** — never suggest React Native or native-only APIs.

Lovable sync: don't rewrite pushed history (force push / rebase / amend / squash). Keep the branch
working — pushed commits sync into the Lovable editor. (Also in `AGENTS.md`.)

## Commands

Package manager is **bun** — `package-lock.json` is stale, ignore it.

- `bun run dev` (vite dev, port 8080) · `bun run build` · `bun run format`
- Gates before calling work done: `bun run typecheck` (`tsc --noEmit`) then `bun run lint`. Both pass
  clean today — keep them that way. The only accepted lint output is 6 `react-refresh` warnings in
  `src/components/ui/*` (shadcn output); don't chase those.
- **No test runner.** Anything behavioural is verified by running the dev server and exercising the
  flow, not by tests.
- A `Stop` hook re-runs typecheck in the background whenever `.ts`/`.tsx` changed, so a failure will
  surface even if you skip the manual run. Hooks in `.claude/hooks/` also hard-block reads of secret
  files (`.env*`, keys, credential stores) and hand-edits to the generated `types.ts` files.

## Two Supabase clients — do not conflate

1. `src/integrations/supabase/*` + its byte-identical duplicate `src/lib/integrations/supabase/*` —
   Lovable Cloud's auto-managed integration. Generated, don't edit. Its `types.ts` describes that
   project, not the one the app queries.
2. `src/lib/integrations/my-supabase/*` — the app's own external project. **This is the one app code
   actually uses** (auth, sessions, every `store.*` route, all four `api.*` routes).

New data/auth work imports from `@/lib/integrations/my-supabase/client` (browser, publishable key — but
RLS is currently *off* on `stores`, `products`, `product_variants`, so it is not row-scoped there) or
`.../client.server` (`supabaseAdmin`, service-role, bypasses RLS — trusted server code only). Full
detail on the client boundary, dynamic-import rule, and type regeneration is in the
`supabase-data-access` skill — it loads on any query/auth/route work, so it isn't repeated here.

Server-only env, `process.env` only: `MY_SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_API_KEY`,
`SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `SHOPIFY_REDIRECT_URI`, `SHIPBUBBLE_API_KEY`.

## Routing traps

Read `src/routes/README.md` before adding routes. The non-guessable bits:

- `routeTree.gen.ts` is generated — never hand-edit.
- Dotted filenames express nesting flatly (`store.products.tsx`). A **trailing underscore before the
  dot** opts that segment out of the parent layout — `store.products_.new.tsx` deliberately escapes
  the `store` shell.
- API routes are ordinary route files exporting `server.handlers` (`src/routes/api.*.ts`).

## Architectural decisions — don't "simplify" these

**SSR error handling is deliberately three layers.** h3 can swallow an in-handler `throw` into a
generic `{"unhandled":true,...}` 500 that a plain `try/catch` never sees. `src/lib/error-capture.ts`
stashes the real error out-of-band (5s TTL); `src/server.ts` detects the swallowed-500 shape and
re-renders it; `src/start.ts` and `__root.tsx` cover the request-level and client-side cases. Each
exists for a distinct failure mode — collapsing them loses coverage.

**Camera-to-edit handoff is an in-memory module variable** (`src/lib/capture-handoff.ts`), not
session/localStorage — captured media is a `Blob`, and client-side navigation never reloads the page.
Known, accepted consequence: hard-refreshing `/create/after-shot/studio` drops the pending capture
and falls back to `/create`.

**`src/lib/categories.ts`**: on a `CategoryNode`, omitting `children` means true leaf; `children: []`
means "has children, not filled in yet". Not interchangeable.

## Conventions

- `src/components/ui/` is shadcn/ui output — treat it as editable app code, not vendored files.
- `bunfig.toml` enforces a 24h `minimumReleaseAge` supply-chain guard (only `@lovable.dev/*` excluded).
  Ask before adding excludes.
- `vite.config.ts` is thin on purpose — `@lovable.dev/vite-tanstack-config` already wires TanStack
  devtools, `tanstackStart`, viteReact, tailwind, tsConfigPaths, Nitro and the `@` alias. Don't re-add.
- LF everywhere. On Windows keep `core.autocrlf=false` for this repo, or every file reads as modified
  and lint output drowns in carriage-return errors.

## Pre-launch state

- **`DEV_STORE_ID` in `store.products_.new.tsx` and `store.products.tsx` is a hardcoded hack.** Real
  store scoping from the session must replace it before launch.
- **The universal size chart is not built.** The `cm`/`in` size systems currently emit plain strings
  like `"91 cm"`, not structured measurements. This needs a schema decision first (where per-value
  cm/inch numbers live: on the option, on `product_variants`, or a separate size-chart table keyed to
  user body measurements) — don't bolt on local-only UI state, it has to persist.
- **RLS is off on `stores`, `products`, `product_variants`** — the browser client can read/write every
  seller's rows. Coupled to `DEV_STORE_ID`: enabling RLS without policies breaks every dashboard write,
  so real store scoping has to land first. See the `supabase-data-access` skill.
- **Public profiles don't work.** The `profiles` SELECT policy is `auth.uid() = id`, so
  `/profile/$username` can only ever load your own profile — anyone else's returns 0 rows (406) and the
  page silently falls back to the URL username with zeroed counts. Opening it up needs a decision
  first: `profiles` also holds `personal_email`, `personal_phone` and `gender`, and RLS is row-level,
  so a public policy exposes those too. A public view over the safe columns (like `profile_stats`) is
  the shape that fits.
