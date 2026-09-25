---
name: liquid-glass
description: The translucent "liquid glass" treatment for floating chrome (bottom nav, home shop/explore toggle, camera and editor controls, messages menus, toasts) — the shared presets in src/lib/liquid-glass.ts, the GLASS_RIM class, which preset to pick, the sliding-lens animation, and what must not get glass.
---

# Liquid glass

One material for chrome that floats _over_ content. It lives in **`src/lib/liquid-glass.ts`** —
spread a preset into `style`, add `GLASS_RIM` to `className`. Don't hand-write a new
`backdropFilter` + shadow combination; that is how the app ended up with ~20 slightly different glasses
that didn't read as one material (unified 2026-09-24).

```tsx
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";

<button className={`relative rounded-full ... ${GLASS_RIM}`} style={glassClear}>
```

## Pick by what sits on it and behind it

| Preset       | Use for                                                        | Examples                                   |
| ------------ | -------------------------------------------------------------- | ------------------------------------------ |
| `glassLight` | dark icons/labels over photos and video                        | `BottomNav` track, `TopToggleNav`          |
| `glassLens`  | the selected indicator sliding inside a `glassLight` track     | the nav and toggle lenses                  |
| `glassClear` | small white-icon controls over the live camera or edited media | camera, after-shot, draw, crop buttons     |
| `glassDark`  | white text that must stay legible over anything                | messages menus, reaction bar, toasts       |

Override `background` after the spread when a surface needs to be denser (toasts use 0.78 so they read
at a glance over white screens; `messages/glass.ts` `glassPanel` also flips the shadow upward for a
bottom-anchored panel). Leave the backdrop filter alone — sharp blur plus high saturation is what
makes it glass instead of frosted plastic.

**`glassClear` is dark-tinted on purpose.** It carries white icons over the camera and photos, and a
white-tinted version made them vanish over bright scenes (2026-09-24). Keep its tint dark and its
backdrop `brightness(<1)`. White icons with no glass behind them at all (the camera tool column, the
after-shot toolbar) go in a container with the `oak-on-media` class, which shadows their edges.

## The rim

`GLASS_RIM` (`.oak-glass-rim` in `styles.css`) is a 1px ring cut from a gradient with a mask, so the
edge is bright where light catches it (top-left, bottom-right) and fades along the sides. It is an
absolute `::before`, so **the element must be positioned** — add `relative` if it isn't already
`absolute`/`fixed`/`sticky`. Presets set `--oak-rim` (0–1) to scale it; don't add a `border` as well.

## The sliding lens

Both lenses are a framer-motion `x` sprung to the selected tab, with `scaleX`/`scaleY` driven by
`useVelocity(x)` so the lens stretches along its direction of travel and settles round. `BottomNav`
also has a module-level **hand-off**: every tab screen renders its own nav, so without it the new
nav would mount with the lens already in place and it would never visibly travel. The unmounting nav
records the lens's x, velocity, lit tab and column width; the next one continues from there. It moves
the lens on tap, before navigating, because `useGoRoot` can take a few hundred ms to unwind history.

## What does NOT get glass

Sheets, cards, and sticky headers (`bg-white/95 backdrop-blur` on the product-form sheets, the
dashboard's `bg-sd-surface/95` bars) are solid surfaces that happen to blur — leave them. So are
scrims behind a sheet, and the camera's empty layout cells (deliberately heavier blur, so they don't
read as a live view). Glass means "this floats above everything"; using it everywhere flattens that.
