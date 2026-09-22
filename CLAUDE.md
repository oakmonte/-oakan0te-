# CLAUDE.md

Oakmonte — content-driven fashion marketplace. TanStack Start (React 19, file-based routing),
Tailwind v4, **deployed to Vercel**. Product is a mobile-first **webapp** — never suggest React
Native or native-only APIs.

Don't rewrite pushed history (force push / rebase / amend / squash). The remote is shared — more
than one agent works this repo — and `AGENTS.md` still carries Lovable's own copy of this rule
inside `LOVABLE:BEGIN/END` markers, which is generated; leave it alone.

## More than one agent works this repo at once

Two agents sharing **one working tree** is the cause of most of the merge and push trouble here.
Git's unit of isolation is the working tree — one checkout, one HEAD, one index — so two writers
in one directory are standing on the same floor. On 2026-09-22 the branch changed underneath a
running task twice, and one agent's uncommitted files kept surfacing in the other's `git status`.

**Give each agent its own worktree.** Same repository and history, separate directory and branch:

```
git worktree add "../oakmonte-<who>" -b <their-branch>
```

Node modules are not shared automatically — junction them rather than reinstalling, or the
worktree cannot typecheck. On Windows, from inside the new worktree:

```
cmd //c mklink //J node_modules "..\..\Oakmonte\node_modules"
```

A junction needs no admin rights, unlike a symlink.
Remove a worktree with `git worktree remove <path>` when the work lands.

If you must touch a file another agent is mid-edit on, do it from a worktree rather than
switching the shared checkout — switching yanks the tree out from under them.

**A `pre-push` hook guards the remote** (`.githooks/pre-push`). It refuses a push carrying
unresolved conflict markers, then runs `tsc --noEmit`. It is **not automatic** — enable it once
per clone, including in every new worktree:

```
git config core.hooksPath .githooks
```

It lives in a tracked directory on purpose. `.git/hooks/` is per-clone and invisible to review,
which is how a repo comes to believe it has protections it does not have. Before this existed
there were no git hooks at all, and a merge was committed with its conflict markers still in it
and pushed to `main` — four files with literal `<<<<<<<` lines, a branch that could not typecheck,
a test file that could not be parsed, and the breakage inherited by every branch that merged
`main` afterwards. `git push --no-verify` skips both checks; needing it often means the check is
wrong, so fix the check rather than routing around it.

**Merge `main` into a long-lived branch often**, and land feature branches quickly. Merge surface
grows every day a branch stays open, and a clean `git merge` is not evidence that two changes are
compatible — see the export crash in the `media-export-pipeline` skill.

## Deployment (Vercel)

`vercel.json` is the whole config: `bun install`, then `bun run build`. Vercel builds from the repo,
so a red gate is a failed deploy.

**A local `bun run build` writes Cloudflare artifacts (`wrangler.json`, `.wrangler/`) and that is
not a bug.** `@lovable.dev/vite-tanstack-config` still defaults Nitro to the Cloudflare preset, but
Nitro picks its preset from the environment: on Vercel, `VERCEL=1` is set and it emits
`.vercel/output/` in Build Output API format instead. Verified 2026-09-16 — `VERCEL=1 bun run build`
locally produces `.vercel/output/functions/__server.func/` and no wrangler config. So **don't "fix"
the preset**; pinning it to `vercel` would break local builds and buy nothing.

Lovable is no longer the deploy or edit surface, but its packages are still in the dependency tree
(`@lovable.dev/vite-tanstack-config` builds the app; see `bunfig.toml` and the `vite.config.ts` note
below). Removing them is a real migration, not a cleanup.

**Import media by path. Never through a `*.asset.json` sidecar.** Lovable stored media in its own
R2 bucket and committed only a JSON pointer whose `url` is `/__l5e/assets-v1/<uuid>/<name>`. Vercel
does not serve that path, so everything behind a sidecar 404s in production — silently, because all
three gates pass: the JSON imports fine, it typechecks, and `<img src>` takes any string. Even
`bun run build` stays green, since there is no file for it to fail to resolve. On 2026-09-22 this
was the footer mark and the story photo on the live landing page.

All twelve sidecars are gone and the real bytes are committed in `src/assets/`. They were recovered
from the old Lovable project host, which was still serving every one of them:

```
https://20ab012d-c075-4dc0-92ec-39b0c7e4fbaa.lovableproject.com/__l5e/assets-v1/<uuid>/<name>
```

Do not rely on that host — it belongs to a platform we have left and can disappear without notice.
It is recorded only so a missing asset can be traced, and `fashion-scale.jpg.asset.json` was a
0-byte sidecar that never had a file behind it at all.

## Commands

Package manager is **bun** — `package-lock.json` is stale, ignore it.

- `bun run dev` (vite dev, port 8080) · `bun run build` · `bun run format`
- **`bun run format` is repo-wide, and that is not what you want mid-change.** It
  reformats every file Prettier can reach, including generated ones — a single run
  rewrote `src/integrations/supabase/types.ts`, `POSTPONED.md` and four other files
  nobody had touched, which then rode along in a `git add -A` and had to be reverted
  out of the commit. Format only what you changed: `bunx prettier --write <files>`.
- `bun run e2e` (Playwright) · `bun run shots` (screenshot sweep) · `bun run e2e:ui`. Config and the
  full "what this cannot test" list are in `playwright.config.ts` and `e2e/README.md`.
- Gates before calling work done: `bun run typecheck` (`tsc --noEmit`), `bun run lint`, `bun run test`.
  All pass clean — keep them that way. Only accepted lint output: 6 `react-refresh` warnings in
  `src/components/ui/*` (shadcn); don't chase those.
- **`bun run test` covers pure logic only** (`bun test`, no framework, `src/**/*.test.ts` — browser
  tests live in `e2e/` and run under Playwright instead, see below): the rules whose
  breakage is silent and expensive — `variant-combinations.ts` (regenerating the variant grid without
  blanking a seller's prices/stock), `necessities.ts` (what counts as filled, and where each answer is
  actually persisted), `weight-estimate.ts` (parsing). Add to these when you change a rule that a
  seller's data depends on. They're excluded from `tsc` (see `tsconfig.json`) because `bun:test` types
  would need `@types/bun`. The script is `bun test src`, not bare `bun test`, because Bun's runner
  also globs `*.spec.ts` and would try to execute the Playwright specs in `e2e/` — which fails with
  "Playwright Test did not expect test() to be called here". Keep the `src` argument.
- **The three gates do not catch a missing asset.** An `import x from "./y.png"` resolves to `any`
  through `vite/client`'s module declaration, so deleting or renaming an image leaves typecheck, lint
  and test all green while `bun run build` fails with `UNRESOLVED_IMPORT` — which on Vercel is a
  failed deploy, not a warning. Run `bun run build` after any change that adds, moves or deletes a
  file under `src/` that something imports by path. Cost us a blocked publish on 2026-09-10, back
  when Lovable silently refused to publish instead of failing loudly.
- **Playwright covers the UI as far as a browser can, which is not as far as you want.** Projects are
  phone-only on purpose — iPhone 13 (WebKit) and Pixel 7 (Chromium); there is no desktop project
  because no screen here is designed for one. Good for layout, copy, routing, ordinary interaction,
  and for catching a route that _throws while rendering_ — the `/create` module-scope hook crash
  passed typecheck, lint and build and would have been caught by a `pageerror` listener.
  **Playwright's WebKit is not iOS Safari**, so everything that actually makes this app hard is
  invisible to it: the standalone storage jar (`isStandalone()` always reports a browser tab), Add to
  Home Screen and the `installed_app` stamp, camera permission surviving a relaunch, `getUserMedia`,
  passkeys, Face ID, `beforeinstallprompt`. Those still need a real phone. Gestures, contentEditable
  and keyboard/viewport behaviour are technically drivable but rarely worth the effort versus a
  device.
- **Assert, don't look — this is a real cost, not a style preference.** A phone-sized screenshot costs
  roughly 1,500 tokens every time an agent reads one, and a judgement call on top; the same check as
  `expect(...)` is a one-line pass/fail. Same rule for the browser tools: `get_page_text` / `read_page`
  return text and should be the default, with screenshots reserved for genuinely visual questions
  (spacing, overlap, a theme). Generating screenshots for an agent to then examine saves nothing.
- `fullPage: true` caps at 32,767 **device** pixels, and the iPhone project emulates 3×, so the real
  ceiling is ~10,922 CSS px. The landing page is ~11,700 and overflows it. Use a viewport screenshot,
  or drop `deviceScaleFactor` to 2 for that run.
- A `Stop` hook re-runs typecheck on `.ts`/`.tsx` changes. Hooks in `.claude/hooks/` also hard-block
  reads of secret files and hand-edits to generated `types.ts` files.

## Two Supabase clients — do not conflate

1. `src/integrations/supabase/*` + its duplicate `src/lib/integrations/supabase/*` — generated by
   Lovable Cloud's integration and left in place after the move off Lovable. **Not dead code:**
   `src/start.ts` attaches `attachSupabaseAuth` from the `lib/` copy on every request, alongside
   `attachMySupabaseAuth`. Nothing regenerates them now. Don't edit them, don't delete them without
   tracing that middleware first, and don't import from them for new work.
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
  devtools, `tanstackStart`, viteReact, tailwind, tsConfigPaths, Nitro and the `@` alias. Don't
  re-add. It still ships despite the move off Lovable; see the Deployment section for why its
  Cloudflare default is harmless on Vercel.
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
  structured cm measurements per category, persisted to `product_size_measurements`. 50 guide
  images are wired across 94 category mappings (tops, bottoms, jackets, skirts, dresses, corsets,
  bodysuits) — extend `CHARTS_BY_CATEGORY` + `GUIDE_IMAGES` to add more. Remaining holes, each for
  its own reason: **footwear** gets no chart ever (a shoe has no lettered spans to measure) but now
  gets `SHOE_SIZE_SYSTEMS` in the manual picker instead of the clothing ladder, selected by
  `isFootwearCategory`; **costume sets, cloaks/capes, accessories and wigs** stay manual because no
  single chart fits them; **bodycon dresses** stay manual because the artwork labels two spans both
  `B`. `size-chart/IMAGE-COMPLAINTS.md` records which of the artwork already in that folder was left
  unwired **on purpose**, and why — check it before wiring more.
- **RLS off** on `stores`, `products`, `product_variants`, and nine other tables — browser client can
  read/write every seller's rows. Store scoping itself is real now (`useOwnStores`/`useActiveStore` in
  `src/hooks/use-own-store.ts`, derived from the signed-in session), so that's no longer what's holding
  this back — a full migration is drafted and reviewed, just deliberately held pending explicit sign-off.
  See `POSTPONED.md` §1.1 and the `supabase-data-access` skill.
