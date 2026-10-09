# CLAUDE.md

Oakmonte — content-driven fashion marketplace. TanStack Start (React 19, file-based routing),
Tailwind v4, deployed to Vercel. Mobile-first **webapp** — never suggest React Native or
native-only APIs.

Don't rewrite pushed history (force push / rebase / amend / squash) — the remote is shared.

## Pivot: sellers-only (2026-10-09)

The full social platform was too much to market. Oakmonte is becoming a store builder
(Shopify/Bumpa/Labeld territory) with one distinction: each seller's site has a **video feed**
buyers scroll endlessly, with the linked products on every video. Camera, editors, themes and
checkout all carry over. Smart size chart ships as a beta selling point.

Three versions:

1. **`oakmonte-master-piece`** (branch; tag `master-piece-2026-10-09`) — the full platform, kept
   safe. Low priority. Finished lane work (discounts, insights, activity — not offline videos)
   is merged in there too.
2. **Sellers-only** (a preview branch) — built toward Paystack going live.
3. **Sellers-only locked** (`main` = production) — same code, with buying blocked by a "not until
   launch" pop-up until Paystack is ready. Production-ready for incoming sellers.

Launch locks (Buy Now, the preview's Open website) live in `src/lib/launch-locks.ts`: locked
by default, unlocked only by `VITE_LAUNCH_UNLOCKED=true`, set in Vercel for the `sellers-only`
preview. Keep both branches' code identical; never lock or unlock by editing code on one branch.

The social side is removed **bit by bit, as Diadem walks through it** — don't strip features
ahead of that. Half-built lanes are WIP on `feature/lane-{discounts,insights,activity,offline}`.

`sellers-only`, `sellers-only-locked` and `main` share the same code (they started from
`oakmonte-master-piece`, so checkout, orders and cart are here); only the launch-lock switch differs.

## Multiple agents share this repo

A shared checkout is the cause of most merge/push trouble here. Give each agent its own worktree:

```
git worktree add "../oakmonte-<who>" -b <their-branch>
cmd //c mklink //J node_modules "..\..\Oakmonte\node_modules"   # Windows; no admin needed
git config core.hooksPath .githooks   # enable the pre-push hook — once per worktree, not automatic
```

The pre-push hook refuses unresolved conflict markers and runs `tsc --noEmit`. Fix the check
rather than `--no-verify` around it. Merge `main` into long-lived branches often; land feature
branches quickly — a clean `git merge` isn't evidence two changes are compatible (see the export
crash in the `media-export-pipeline` skill).

## Deployment (Vercel)

`vercel.json` is the whole config. **A local `bun run build` writes Cloudflare artifacts
(`wrangler.json`, `.wrangler/`) — expected, not a bug.** Nitro's preset comes from the
environment; Vercel sets `VERCEL=1` and gets `.vercel/output/` instead. Don't pin the preset to
"fix" this — it would break local builds for nothing. `@lovable.dev/vite-tanstack-config` still
builds the app despite the move off Lovable (see `bunfig.toml`, `vite.config.ts`); removing it is
a real migration, not a cleanup.

**Import media by path, never through a `*.asset.json` sidecar.** Those are dead pointers into a
Lovable-era host we no longer control — the JSON imports fine and typechecks fine while the image
404s in production, invisibly, because nothing about the sidecar itself is wrong.

## Commands

Bun, not npm (`package-lock.json` is stale).

- `bun run dev` · `bun run build` · `bun run typecheck` (`tsc --noEmit`) · `bun run lint` ·
  `bun run test` — the last one is `bun test src`, not bare `bun test` (Bun's runner also globs the
  Playwright specs in `e2e/` and fails trying to run them).
- Format only what you changed: `bunx prettier --write <files>`. `bun run format` is repo-wide and
  will rewrite generated files and anything else Prettier can reach.
- **None of typecheck/lint/test catch a missing asset import** — `vite/client` types
  `import x from "./y.png"` as `any`. Run `bun run build` after adding, moving or deleting any file
  under `src/` that something imports by path.
- `bun run e2e` (Playwright — iPhone 13 WebKit + Pixel 7 Chromium only, no desktop project) catches
  layout, routing, and a route that throws while rendering. It can't reach anything iOS-specific:
  standalone storage, Add to Home Screen, camera-permission persistence, passkeys. See
  `e2e/README.md` for the full list.
- Prefer `expect(...)` / `get_page_text` over screenshots in tests and browser tools — a screenshot
  costs tokens and a judgement call for what a one-line assertion already answers.
- A `Stop` hook re-typechecks on `.ts`/`.tsx` changes. `.claude/hooks/` blocks reads of secret files
  and hand-edits to generated `types.ts` files.

## Two Supabase clients — do not conflate

- `src/integrations/supabase/*` + `src/lib/integrations/supabase/*` — Lovable-generated. **Not dead
  code**: `src/start.ts` still attaches auth middleware from the `lib/` copy. Don't edit, don't
  delete without tracing that first, don't import from for new work.
- `src/lib/integrations/my-supabase/*` — the real one. Everything else uses this.

Full client/RLS/secrets detail is in the `supabase-data-access` skill.

## Routing

Read `src/routes/README.md` before adding routes. `routeTree.gen.ts` is generated — never hand-edit.
A trailing underscore before the dot (`store.products_.new.tsx`) opts that segment out of the
parent layout.

## Don't simplify these

- **SSR error handling is three layers on purpose.** h3 can swallow a thrown error into a generic
  `{"unhandled":true}` 500 that a plain try/catch never sees. `error-capture.ts`, `server.ts`, and
  `start.ts`/`__root.tsx` each cover a different failure mode — collapsing them loses coverage.
- **Camera-to-edit handoff is an in-memory module variable** (`capture-handoff.ts`), not
  session/localStorage. See the `media-export-pipeline` skill for why.
- **`categories.ts`**: on a `CategoryNode`, omitting `children` means true leaf; `children: []`
  means "has children, not filled in yet." Not interchangeable.

## Conventions

- `src/components/ui/` (shadcn output) is editable app code, not vendored.
- `bunfig.toml`'s 24h `minimumReleaseAge` supply-chain guard excludes only `@lovable.dev/*` — ask
  before adding more.
- LF everywhere; keep `core.autocrlf=false` on Windows.
- Every `<video>` needs `playsInline muted disablePictureInPicture disableRemotePlayback`, never
  `controls` — each removes a piece of browser chrome that would otherwise paint over full-bleed
  media. `muted` also makes autoplay work. `media-session.ts` shapes the OS-level now-playing card
  that playing audio triggers (Control Centre, notification shade); nothing in-page can touch that.
- PWA install: `manifest.webmanifest` + the `apple-mobile-web-app-*` meta tags in `__root.tsx` — iOS
  reads only the meta tags, so both halves are load-bearing. A standalone install gets its own
  storage jar (signed out on first launch — expected) and its own camera-permission grant (persists
  across launches, unlike a page load in Safari, which re-asks every time).
- **Seller dashboard (`/store/*`) follows the phone's light/dark scheme; the rest of the app is
  fixed.** Color it with the `--sd-*` tokens, never `dark:` (bound to a `.dark` class nothing adds)
  or hardcoded grays/`bg-white`. The surface is decided once by `src/lib/surface.ts`; don't set page
  background from an effect, and don't declare the dashboard's `theme-color` in a route's `head()`
  (TanStack dedupes meta by `name` alone, collapsing a light/dark pair into whichever is declared
  last). `isHeldLight()` in `surface.ts` force-lights the couple of screens still rendering
  unconverted product-form markup as their whole page — delete an entry once that screen's on
  tokens; don't add one just because a sheet or one inline piece inside an otherwise-dark page
  renders light, that's an accepted tradeoff, not a bug. The exception is `/store/theme`, which is
  held light **permanently, by product decision** (its cards are real storefront colours, and the
  dark ones vanish on a dark page). Don't delete it along with the product-form entries.

## Performance

Mobile-first, often on slow networks.

- Only core fonts load in `__root.tsx`; anything bigger (the 66-family theme picker) loads on
  demand, split across several requests rather than one over-long URL.
- Preload the LCP image via the route's `head().links`; lazy-load everything below the fold.
- Heavy editors (studio, camera, after-shot, mediabunny) must stay inside their own route
  chunks — verify with a production build that they don't leak into a shared chunk.
- Prefetch the next step in a wizard with `router.preloadRoute(...)` after mount.
- Measure with a real build and the Network tab. A change that only feels faster isn't done.

## Pre-launch state

Short form here, full detail in `POSTPONED.md` — keep the two in step. RLS is **on** for the
store and catalogue tables (`20261009120000_store_catalogue_rls.sql`, applied 2026-10-09): reads
public, writes owner-only via the `owns_*` helpers, and `stores`' private columns (contact,
pickup address, Shopify/Bumpa) have no SELECT grant for anon/authenticated — **the browser must
never select them**; read them server-side. A new store-scoped table needs RLS + policies in its
own migration; check `mcp__supabase__get_advisors` after any DDL. Anonymous sign-ins are on:
anonymous accounts get the `authenticated` role, so any write policy a buyer-side feature adds
must exclude them (`auth.jwt() ->> 'is_anonymous'`) where they shouldn't act (offers, stores).
The direct-messages and read-receipts migrations are applied; follow-ups (regenerate types, a
two-account tick check) are in POSTPONED §1.4.
Message bodies, third-party tokens and payout account numbers are encrypted at the app layer (not
E2E); the rollout order (key → relax migration → deploy → backfill → require migration) is
POSTPONED §1.5. Never
write those columns without `encryptField`, and never read message bodies from the browser.
