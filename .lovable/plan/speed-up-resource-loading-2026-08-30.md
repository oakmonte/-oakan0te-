# Speed up resource loading

## Biggest win: the font stylesheet

`src/routes/__root.tsx` loads a single Google Fonts stylesheet with **~38 font families** (Inter, Anton, Playfair, Abril Fatface, Cinzel, Unbounded, Bricolage, Staatliches, etc.) on every page. That CSS — and the font files it pulls in — blocks first paint site-wide.

- Almost all of those families exist only for the store-theme editor's font picker (`src/components/store-themes/fonts.ts` `FONT_OPTIONS`). Core app pages only use Inter, Cormorant Garamond, and a couple of display faces.
- **Fix:** slim the root stylesheet down to the fonts the core app actually renders with, and load the theme-picker fonts on demand — inject the full stylesheet only when the store-theme editor/preview mounts (or per selected font). Days-long caching makes repeat visits free, but first paint no longer waits on 38 families.
- Also add the missing `preconnect` to `https://fonts.gstatic.com` (only `fonts.googleapis.com` is preconnected today).

## Second win: the body-type image folder

`src/assets/body-types/` is 2.4 MB, dominated by two PNGs (`Body-type-measurement-male.png` 872 KB, `Body-type-measurement-female.png` 686 KB) plus chart webps. They're used by `find-your-fit.tsx` (already `loading="lazy"`, good).

- **Fix:** convert the two large PNGs to compressed WebP (same visual size) and downscale the largest chart images — cutting this folder from ~2.4 MB to well under 1 MB. No behavior change.

## Third win: preload the landing hero

The landing page hero (`hero-editorial.jpg`, 112 KB) is the LCP image but gets no preload hint.

- **Fix:** add a route-level `<link rel="preload" as="image">` in `src/routes/index.tsx`'s `head()` so the hero starts downloading with the HTML instead of after JS hydration.

## Fourth win: keep heavy editors out of the main bundle

The studio (mediabunny video pipeline) and camera/after-shot code are only needed on their own routes.

- **Fix:** verify they code-split cleanly with the route files (TanStack Start splits per route by default); if the studio's media libraries leak into shared chunks, lazy-load them behind the studio route so the landing/home pages never download them.

## What won't change

- No visual or copy changes. The store-theme font picker keeps every font — they just load when that screen opens, not on every page.
- Verification: run a production build to compare chunk sizes, and check the preview's network tab to confirm the slimmed font stylesheet and hero preload.

## Technical notes

- Root font link edit: `src/routes/__root.tsx` head links (~line 151).
- On-demand font loading: a small helper that injects a `<link>` once, called from the store-theme components; public storefront pages that render a store's chosen theme load just that one family.
- Image conversion: `ffmpeg`/sharp-free CLI conversion of the two PNGs to `.webp`, update imports in `find-your-fit.tsx`.
- Hero preload: `head().links` in `src/routes/index.tsx` per the perf preload pattern.
