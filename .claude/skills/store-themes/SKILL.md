---
name: store-themes
description: How to add or edit a storefront theme in src/components/store-themes/ — the two places every theme must exist (card mockup + full interactive preview), which props are shared vs. bespoke, and the conventions that aren't visible from reading any single file. Use when adding a new theme, removing one, or changing the shared edit-mode chrome (fonts, undo/redo, layout presets).
---

# Store themes

A theme exists in **two places** and both are required, or it 404s from one surface and not the
other:

1. **Card mockup** — a `*Preview` component in `src/components/store-theme-selector.tsx`, wired into
   `StorefrontPreview`'s if-chain. Static, no `editing` prop, just sets the visual tone on the
   `/store/theme` grid.
2. **Full interactive preview** — a `*Full` component in `src/components/store-themes/full-previews.tsx`,
   wired into the `FullPreview` switch. This is what actually renders inside `ThemePreviewSheet` in
   both view and edit mode.

Plus one `Theme` entry in `src/components/store-themes/types.ts` (`THEMES` array) — `id`, `name`,
`eyebrow`, `description`, `accent`, `demoBrand`. The `id` is the `ThemeId` union member; add it there
too.

## The `*Full` component contract

Every `*Full` component takes one optional `editing?: ThemeEditingProps` prop and is built from the
same shared blocks in `full-preview-blocks.tsx`: `PhoneHeader`, `HeroSlideshow`, `StatsRow`,
`CollectionsGrid`, `PromoBanner`, `FooterTeaser`. Don't invent new bespoke markup for these — a theme
distinguishes itself through **color/copy/hero decoration only**, passed as props into the shared
blocks. This is why adding theme #9 is a config exercise, not another few hundred lines of JSX.

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

`fonts.ts` intentionally now loads a fixed set of ~12 Google Fonts (see the `<link>` in
`__root.tsx`) picked for fashion/editorial range — this was a deliberate one-time network-cost
decision, not an oversight. Do **not** add a 13th font per-theme; if a theme needs a distinctive
display face, prefer one already in `FONT_OPTIONS`.

## Undo/redo

`ThemePreviewSheet` keeps `{ current, history, future }` in one `useState` (not three) — `history`
before StrictMode double-invocation is the reason it's one object; see the comment above `mutate()`
before changing it. Any real seller edit through `mutate()` clears `future` — redo only replays what
was just undone in this session, it doesn't survive a fresh edit.

## Everything else

Backend wiring (per-store-per-theme persistence) is session-only today — see `POSTPONED.md` and the
`supabase-data-access` skill for the `store_theme_customizations` table. Don't wire a new theme's save
path differently from the others; it goes through the same `ThemeEditState`.
