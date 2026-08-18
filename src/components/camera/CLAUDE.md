# Camera / after-shot conventions

Flow: `src/routes/create.tsx` → `create.after-shot.tsx` (layout) → `.index.tsx` / `.edit.tsx` /
`.filters.tsx`. Post-capture editing (crop / draw / text / filters / layout) is backed by this
directory and `aftershot/`.

- **Control surfaces are panels**, one per tool, following `CameraPanel.tsx` — match that shape
  (`FilterPanel`, `FlashPanel`, `RatioPanel`, `TimerPanel`, `LayoutPanel`, `aftershot/DrawPanel`,
  `aftershot/TextPanel`, `aftershot/CropPanel`).
- Icons: the after-shot toolbar uses hand-rolled inline SVGs in `aftershot-icons.tsx`; the panels use
  `lucide-react` for generic glyphs. Prefer `aftershot-icons.tsx` when an equivalent already exists.
- **Any route or panel with a text input calls `useLockedViewport()`**
  (`@/hooks/use-locked-viewport`) so the mobile keyboard overlays instead of pushing the page up.
- The route→route media handoff is an in-memory module variable (`src/lib/capture-handoff.ts`), not
  storage — see the root `CLAUDE.md`. `src/lib/after-shot-context.ts` is the React context the edit
  sub-routes consume.
- Media helpers live in `src/lib/`: `crop-media.ts`, `filter-media.ts`, `video-trim.ts`,
  `layer-bake.ts`, `canvas-filter.ts`, `after-shot-layers.ts`, `after-shot-export.ts`. Encode/decode
  goes through **`mediabunny`** (client-side, in `video-trim.ts` / `after-shot-export.ts`) — note this
  is the media library, unrelated to Bunny.net.
