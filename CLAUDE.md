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
  clean — keep them that way. Only accepted lint output: 6 `react-refresh` warnings in
  `src/components/ui/*` (shadcn); don't chase those.
- **No test runner.** Behavioural verification = run the dev server and exercise the flow.
- A `Stop` hook re-runs typecheck on `.ts`/`.tsx` changes. Hooks in `.claude/hooks/` also hard-block
  reads of secret files and hand-edits to generated `types.ts` files.

## Two Supabase clients — do not conflate

1. `src/integrations/supabase/*` + its duplicate `src/lib/integrations/supabase/*` — Lovable Cloud's
   auto-managed integration. Generated, don't edit.
2. `src/lib/integrations/my-supabase/*` — the app's own external project. **This is the one app code
   actually uses** (auth, sessions, every `store.*` route, all `api.*` routes).

Full detail on the client boundary, dynamic-import rule, type regeneration, RLS state, and secrets is
in the `supabase-data-access` skill — it loads on any query/auth/route work.

## Routing traps

Read `src/routes/README.md` before adding routes. The non-guessable bits:

- `routeTree.gen.ts` is generated — never hand-edit.
- Dotted filenames express nesting flatly (`store.products.tsx`). A **trailing underscore before the
  dot** opts that segment out of the parent layout — `store.products_.new.tsx` escapes the `store` shell.
- API routes are ordinary route files exporting `server.handlers` (`src/routes/api.*.ts`).

## Architectural decisions — don't "simplify" these

**SSR error handling is deliberately three layers.** h3 can swallow an in-handler `throw` into a
generic `{"unhandled":true,...}` 500 that a plain `try/catch` never sees. `src/lib/error-capture.ts`
stashes the real error out-of-band (5s TTL); `src/server.ts` detects the swallowed-500 shape and
re-renders it; `src/start.ts` and `__root.tsx` cover the request-level and client-side cases. Each
exists for a distinct failure mode — collapsing them loses coverage.

**Camera-to-edit handoff is an in-memory module variable** (`src/lib/capture-handoff.ts`), not
session/localStorage. Detail and accepted consequence in the `media-export-pipeline` skill.

**`src/lib/categories.ts`**: on a `CategoryNode`, omitting `children` means true leaf; `children: []`
means "has children, not filled in yet". Not interchangeable.

## Conventions

- `src/components/ui/` is shadcn/ui output — treat it as editable app code, not vendored files.
- `bunfig.toml` enforces a 24h `minimumReleaseAge` supply-chain guard (only `@lovable.dev/*` excluded).
  Ask before adding excludes.
- `vite.config.ts` is thin on purpose — `@lovable.dev/vite-tanstack-config` already wires TanStack
  devtools, `tanstackStart`, viteReact, tailwind, tsConfigPaths, Nitro and the `@` alias. Don't re-add.
- LF everywhere. On Windows keep `core.autocrlf=false` for this repo.

## Pre-launch state

Full list, including everything postponed on purpose, in `POSTPONED.md` at the repo root.
Keep the two in step — this section is the short form.

- **`DEV_STORE_ID` hardcoded** in `store.products_.new.tsx` and `store.products.tsx`. Real
  session-derived store scoping must replace it before launch.
- **Size chart not built.** `cm`/`in` size systems emit plain strings like `"91 cm"`, not structured
  measurements. Needs a schema decision before any UI work — don't bolt on local-only state.
- **RLS off** on `stores`, `products`, `product_variants` — browser client can read/write every
  seller's rows. Coupled to `DEV_STORE_ID`: enabling RLS without policies breaks every dashboard write.
  See the `supabase-data-access` skill.
- **Public profiles broken.** `profiles` SELECT policy is `auth.uid() = id`, so `/profile/$username`
  returns 406 for anyone else's profile and silently falls back to zeroed counts. Fix requires a public
  view over safe columns — `profiles` also holds `personal_email`, `personal_phone`, `gender`, so a
  row-level public policy exposes those.
