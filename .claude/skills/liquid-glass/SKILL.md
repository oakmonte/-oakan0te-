---
name: liquid-glass
description: The translucent, blurred "liquid glass" surface treatment used for floating chrome (the bottom nav pill, the home page shop/explore toggle) — the exact CSS recipe, when to use the richer vs. lighter variant, and why it's inline styles, not Tailwind classes.
---

# Liquid glass

A floating-surface treatment for chrome that sits *over* scrollable content rather than being part of
the page flow — the bottom nav pill (`src/components/BottomNav.tsx`) and the home page's shop/explore
toggle (`src/components/TopToggleNav.tsx`) are the two reference implementations. There is no shared
component for this yet — each surface writes its own inline `style` object with this recipe, because
the exact values (opacity, shadow spread) get tuned per-surface against what's likely to sit behind it.

## The recipe

Every liquid-glass surface needs all four of these together — dropping any one of them reads as a flat
translucent box, not glass:

```ts
style={{
  background: "rgba(255,255,255,0.07)",      // translucency — see "Two variants" below
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)", // Safari still needs the prefix
  boxShadow: "0px 8px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.25)",
  border: "1px solid rgba(255,255,255,0.12)",
}}
```

- **`blur(20px) saturate(180%)`** is the fixed pair — the blur alone looks frosted-flat; `saturate`
  is what makes colors bleeding through from behind read as rich rather than washed out. Don't tune
  these two per-surface; only `background`'s opacity and the shadow values flex.
- **The `inset 0 1px 0 rgba(255,255,255,0.25)`** in the box-shadow is the light-catching-an-edge
  highlight — the single biggest thing that reads as "glass" instead of "translucent panel." Always
  pair it with the outer drop shadow in the same `boxShadow` string (comma-separated), not a second
  property.
- **The 1px border** at low opacity is what keeps the edge legible against a bright or busy
  background — without it the surface can disappear entirely over a light photo.
- `backgroundBlendMode: "screen"` (used on `BottomNav`) is optional — it lightens the blend against
  whatever blurred content is behind it. Reach for it on surfaces that sit over photo grids/video,
  skip it over already-flat/pale backgrounds.

## Two variants — pick by what's behind the surface

**Rich (BottomNav's values, shown above)** — `rgba(255,255,255,0.07)` background, full shadow+border
recipe. Use this by default, especially over photos, video, or anything with real contrast behind it —
the low-opacity background lets that content read through while blur+saturate still do the work.

**Flatter (TopToggleNav's values)** — `rgba(255,255,255,0.65)` background, `boxShadow: "0px 8px 40px
rgba(0,0,0,0.12)"` only (no inset highlight, no border). This trades some of the "glass" read for
legibility when the surface needs to stay readable over a busy, bright background (TopToggleNav sits
directly above a photo grid on the home page) — a low-opacity rich variant here would wash out and lose
contrast against light photos. Reach for this only when the rich variant is tested and genuinely
illegible in place; default to rich otherwise.

## What NOT to do

- Don't reach for a Tailwind `backdrop-blur-*` + `bg-white/10` combo instead of the inline `style`
  recipe above — Tailwind's blur utilities don't include `saturate()`, and re-deriving the shadow/border
  values as arbitrary-value classes is harder to keep in sync with the other surfaces than one shared
  inline object.
- Don't apply this to anything that isn't floating chrome over scrollable content (nav pills, sticky
  toggles). A regular card or sheet background should use the app's normal solid/opaque surfaces —
  liquid glass reads as a deliberate "this floats above everything else" signal, and using it
  everywhere flattens that signal.
