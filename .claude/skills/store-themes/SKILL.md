---
name: store-themes
description: How to add or edit a storefront theme in src/components/store-themes/ — writing a theme as a spec, the database row without which it silently cannot be selected, which props are shared vs. bespoke, and the conventions that are not visible from reading any single file. Use when adding a new theme, removing one, or changing the shared edit-mode chrome (fonts, undo/redo, layout presets).
---

# Store themes

There are **43 themes in two forms**. Write new ones as specs; the components are history.

1. **Spec themes (35)** — an entry in `theme-specs.ts`, rendered by `ThemeSpecFull.tsx`. ~25 lines of
   data: palette, two font ids, hero alignment/size, one decoration, copy, and the placeholder tiles.
   Everything else (tile tints, promo card, avatar cluster, the readable-text version of the accent)
   is **derived from the accent** by helpers in `theme-spec.ts`, so a theme cannot drift out of tune
   with itself. **This is how you add a theme.**
2. **Component themes (8)** — the originals (`MotionGridFull`, …) in `full-previews.tsx`, each with a
   genuinely bespoke hero. Left as components deliberately; don't add a ninth.

Both are reached through `FullPreview`'s switch, which has a `default:` that renders a spec. That
default is **not** unreachable: `useStoreTheme` casts whatever slug the database returns straight to
`ThemeId`, so a row with nothing behind it arrives as a value matching no case, and falling out of the
switch used to return `undefined` — which React throws on, white-screening a public storefront.

Two more places, both easy to miss:

- **`ThemeId` + `THEMES` in `types.ts`.** The union lists every slug explicitly (spec ids included) so
  `ThemeId` stays a plain literal union with no import cycle back into the specs. `THEMES` is
  `BASE_THEMES` plus entries derived from `THEME_SPECS`, so a card and its storefront can never
  disagree about a theme's own name or accent.
- **A `store_themes` row.** `useStoreTheme.selectTheme` looks a theme up **by slug** before writing
  `stores.theme_id`, and does nothing when the row is missing. A theme with no row looks selectable,
  then silently reverts on reload with no error anywhere. Seed it in a migration — see
  `20260912090000_seed_spec_store_themes.sql`, which also retires rows with no theme behind them.

## The `*Full` component contract

Every `*Full` component takes one optional `editing?: ThemeEditingProps` prop and is built from the
same shared blocks in `full-preview-blocks.tsx`: `PhoneHeader`, `HeroSlideshow`, `StatsRow`,
`CollectionsGrid`, `PromoBanner`, `FooterTeaser`. Don't invent new bespoke markup for these — a theme
distinguishes itself through **color/copy/hero decoration only**, passed as props into the shared
blocks — which is what let the catalogue go from 8 to 43 as data rather than 4,000 more lines of JSX.

The four blocks after the hero (`stats`/`collections`/`promo`/`footer`) are reorderable — build them
as a `Partial<Record<ArrangeableBlockId, ReactNode>>` map and render with
`orderedBlocks(editing, blocks)`, not a fixed sequence. `collections` is never wrapped in
`hidden.includes(...)` — it can't be removed, only its mode (collections/products) toggled, because it
always routes back to real seller data via `useThemePreviewCatalog`.

Text the seller can edit goes through `<ThemeText editing={editing} field="..." defaultValue="..." />`,
never a raw `<p>`, or it won't participate in edit mode / undo / font choice. `TextFieldId` (in
`edit-types.ts`) is a closed union — adding a new editable field means adding it there first.

Hero sections are the one place each theme is genuinely bespoke (background gradient, decoration,
headline layout) — everything below the hero is shared blocks.

## Live drop is compulsory

Every theme must include a live-drop element — a countdown/urgency piece surfacing the store's next
or current live drop. **This isn't built yet anywhere**: the only trace of it today is a single
tooltip string in `full-preview-blocks.tsx` ("A live drop timer will be available at full launch"),
not a real component, and no existing theme actually renders one. Treat this section as the
requirement for whatever ships it, not a description of current behavior — when a real live-drop
component exists, it belongs in `full-preview-blocks.tsx` as a shared block (per the "config exercise,
not bespoke JSX" rule above) so every theme picks it up the same way, rather than each theme growing
its own bespoke countdown markup.

## What NOT to add back

- **No star-rating badge.** It was deliberately removed from `StatsRow` — ratings live on the profile
  page, and a hardcoded 4.8/4.9-style badge reads as a fabricated credential. `StatsRow` today is just
  the avatar cluster + follower text.
- **No fixed-height image boxes.** `CollectionsGrid` tiles use `aspect-[4/5]` + `object-cover`, not a
  fixed `h-*`, so tiles read as tall/dynamic without per-image layout logic. Match that pattern for any
  new image container instead of picking a pixel height.

## Fonts

`FONT_OPTIONS` carries **70 faces**. Four are core (loaded in `__root.tsx`); the other 66 load **on
demand** — `ensureThemeFont` for the one a storefront actually renders, `ensureThemePickerFonts` when
the seller opens the picker. A storefront must never pull a family it does not render.

`ensureThemePickerFonts` splits its request across six css2 URLs rather than one. At 66 families a
single URL runs past 2.5KB, and anything that truncates or rejects a request that long drops every
font at once — silently, since a stylesheet that fails to load just leaves the fallback in place.

Prefer a face already in `FONT_OPTIONS`. If you genuinely need a new one, add it in all three places
(the `FontId` union, `FONT_OPTIONS`, `GOOGLE_FAMILY_PARAMS`) or it will render as a fallback with no
error.

## Counts are real, wording is the seller's

`StatsRow` and `FooterTeaser` show live numbers from `useStoreCommunityCounts` (followers, and items
sold for "wearing it"). These are **not editable** — the themes used to hardcode "2.7K+ followers"
and "142 people wearing it today", which reads as a fabricated credential on a store that has
neither, the same objection that removed the star rating. The **wording** around each number stays
per-theme and stays editable (`statsFollowersText`), which is why every theme phrases it differently
("followers love this store", "in the atelier").

## Accent as fill vs accent as text

A theme's accent is chosen to look right as a **fill**. Several of the brighter palettes land near
2:1 against their own pale background, which is unreadable at the 11–12px the hero eyebrow and "View
all" are set in. `readableAccent()` derives a darker (or, on a dark ground, lighter) version for text
and strokes while fills keep the raw accent. Don't hand-tune per theme — a hand-tuned value rots the
next time a palette changes.

## Undo/redo

`ThemePreviewSheet` keeps `{ current, history, future }` in one `useState` (not three) — `history`
before StrictMode double-invocation is the reason it's one object; see the comment above `mutate()`
before changing it. Any real seller edit through `mutate()` clears `future` — redo only replays what
was just undone in this session, it doesn't survive a fresh edit.

## Everything else

Backend wiring (per-store-per-theme persistence) is session-only today — see `POSTPONED.md` and the
`supabase-data-access` skill for the `store_theme_customizations` table. Don't wire a new theme's save
path differently from the others; it goes through the same `ThemeEditState`.
