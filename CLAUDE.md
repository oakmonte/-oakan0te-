# CLAUDE.md

Oakmonte — content-driven fashion marketplace. TanStack Start (React 19, file-based routing),
Tailwind v4, deployed to Cloudflare (Nitro `cloudflare` preset), built/maintained through Lovable.
Product is a mobile-first **webapp** — never suggest React Native or native-only APIs.

Lovable sync: don't rewrite pushed history (force push / rebase / amend / squash). Keep the branch
working — pushed commits sync into the Lovable editor. (Also in `AGENTS.md`.)

## Commands

Package manager is **bun** — `package-lock.json` is stale, ignore it.

- `bun run dev` (vite dev, port 8080) · `bun run build` · `bun run format`
- Gates before calling work done: `bun run typecheck` (`tsc --noEmit`), `bun run lint`, `bun run test`.
  All pass clean — keep them that way. Only accepted lint output: 6 `react-refresh` warnings in
  `src/components/ui/*` (shadcn); don't chase those.
- **Tests cover pure logic only** (`bun test`, no framework, `src/**/*.test.ts`): the rules whose
  breakage is silent and expensive — `variant-combinations.ts` (regenerating the variant grid without
  blanking a seller's prices/stock), `necessities.ts` (what counts as filled, and where each answer is
  actually persisted), `weight-estimate.ts` (parsing). Add to these when you change a rule that a
  seller's data depends on. They're excluded from `tsc` (see `tsconfig.json`) because `bun:test` types
  would need `@types/bun`.
- **The three gates do not catch a missing asset.** An `import x from "./y.png"` resolves to `any`
  through `vite/client`'s module declaration, so deleting or renaming an image leaves typecheck, lint
  and test all green while `bun run build` fails with `UNRESOLVED_IMPORT` — and Lovable then silently
  refuses to preview or publish. Run `bun run build` (~5s) after any change that adds, moves or
  deletes a file under `src/` that something imports by path. Cost us a blocked publish on 2026-09-10.
- **Nothing tests the UI.** Interaction behaviour — sheets, gestures, contentEditable, keyboard/
  viewport — is only verifiable by running the dev server and exercising the flow on a real device.
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

### Every `<video>` carries four attributes

`playsInline muted disablePictureInPicture disableRemotePlayback`, and **never `controls`**. Not
style — each one removes a piece of browser UI that would otherwise be painted over our media, which
is unacceptable on a full-bleed feed people scroll like TikTok. `controls` draws the whole native
bar; `playsInline` stops iOS playing fullscreen with its own chrome; the other two remove the
picture-in-picture arrow and the AirPlay/Cast button, including from the right-click menu. Copy all
four onto any new video element — `muted` is also what lets autoplay work at all.

That covers everything drawn _inside_ the page. It cannot touch what the OS draws **outside** it:
once audio plays, iOS Control Centre, Android's notification shade and desktop Chrome's toolbar each
get a now-playing card, and no web API removes them. `src/lib/media-session.ts` shapes that card —
what it says, and declining the skip buttons by never registering a handler for them. Read it before
assuming a lock-screen control is a bug.

### Installable web app

`public/manifest.webmanifest` plus the `apple-mobile-web-app-*` meta tags in `__root.tsx`. iOS reads
none of the manifest's display fields, so both halves are load-bearing — drop the meta tags and "Add
to Home Screen" produces a bookmark that opens in Safari.

The install is not cosmetic. **A standalone iOS web app has its own permission store**, so the camera
grant survives between launches instead of being re-asked every visit — which is the only real fix
for that, since Safari grants camera per page load and no API overrides it. It also gets its own
cookie and localStorage jar, separate from Safari's: **a user who installs is signed out on first
launch and has to sign in again.** That is expected, not a bug.

Regenerate icons from `public/favicon.png` with the `canvas` package already in node_modules: `any`
icons at 62% inset, `maskable` at 46% (Android crops to a squircle and will shave the ends off
anything larger), `apple-touch-icon` at 180px.

## Performance — keep it fast

Every page is mobile-first and often on slow networks. Treat load speed as a first-class feature.

**Fonts.** Only the core app fonts belong in `src/routes/__root.tsx`'s Google Fonts link. Theme-picker fonts (the ~66-family list) must load on demand inside the theme editor, not on every route, and `ensureThemePickerFonts` splits them across several css2 requests rather than one over-long URL. Always preconnect `https://fonts.gstatic.com`.

**Images.** Prefer WebP. Preload the LCP image via the leaf route's `head().links` with `rel: "preload"`, `as: "image"`, `fetchpriority: "high"`. Keep `loading="lazy"` for below-the-fold images. Convert oversized PNGs/JPEGs; downscale charts and illustrations that are larger than their rendered size.

**Code splitting.** TanStack Start splits by route by default. Heavy editors (studio, camera, after-shot, mediabunny) should live only inside their own route chunks — verify with a production build that they do not leak into `index-*.js` or shared vendor chunks.

**Heavy reference data.** Never import a multi-megabyte dataset at the top of a widely-used component. Split it: ship a small seed synchronously for the common case, start the full dataset with a dynamic import when the sheet mounts, and swap in full coverage when it arrives. Provide a non-blocking "loading…" cue and always keep a typed fallback.

**Prefetch the next screen.** In wizards and onboarding, each step should call `router.preloadRoute({ to: nextRoute(...) })` after mount (defer with `requestIdleCallback` / `setTimeout`) so the next route's chunk is already in memory before the user taps. For image-heavy next steps, warm the images in priority tiers with `new Image()` preloads.

**Measure before claiming a win.** Run `bun run build` and compare chunk sizes. Check the preview's Network tab for the actual request timing. A change that only feels faster is not done until the numbers show it.

## Pre-launch state

Full list, including everything postponed on purpose, in `POSTPONED.md` at the repo root.
Keep the two in step — this section is the short form.

- **Size chart mostly done.** `src/lib/size-chart-config.ts` + `SizeChartSheet` collect real,
  structured cm measurements per category, persisted to `product_size_measurements`. 27 guide
  images are wired up (tops, bottoms, corsets, bodysuits); shoes, dresses, and costumes still fall
  back to manual-pick-only (`ManualSize`), no chart yet — extend `CHARTS_BY_CATEGORY` +
  `GUIDE_IMAGES` to add more. `size-chart/IMAGE-COMPLAINTS.md` records which of the artwork
  already in that folder was left unwired **on purpose**, and why — check it before wiring more.
- **RLS off** on `stores`, `products`, `product_variants`, and nine other tables — browser client can
  read/write every seller's rows. Store scoping itself is real now (`useOwnStores`/`useActiveStore` in
  `src/hooks/use-own-store.ts`, derived from the signed-in session), so that's no longer what's holding
  this back — a full migration is drafted and reviewed, just deliberately held pending explicit sign-off.
  See `POSTPONED.md` §1.1 and the `supabase-data-access` skill.
