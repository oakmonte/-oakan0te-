# Camera / after-shot conventions

Flow: `src/routes/create.tsx` → `create.after-shot.tsx` (layout) → `.index.tsx` / `.studio.tsx` /
`.filters.tsx`. Post-capture editing (crop / draw / text / filters / layout) is backed by this
directory and `aftershot/`.

`.studio.tsx` is the multi-clip **video editor** and is a world of its own — its components live in
`src/components/studio/`, its logic in `src/lib/studio/`, and it does NOT follow the CameraPanel
shape (see `src/lib/studio/README.md`). It replaced the old single-clip `.edit.tsx` trim screen.
The editor itself is `components/studio/StudioEditor.tsx`; two routes host it — this one (after a
capture, result back to after-shot) and `create.studio.tsx` ("New video", result to publish, edit
parked in `lib/studio/session.ts`). `create.video-editor.tsx` is the old editor, redirected to
`/create/studio` unless `?legacy=1`, due for deletion.

- **Control surfaces are panels**, one per tool, following `CameraPanel.tsx` — match that shape
  (`FilterPanel`, `FlashPanel`, `RatioPanel`, `TimerPanel`, `LayoutPanel`, `aftershot/DrawPanel`,
  `aftershot/TextPanel`, `aftershot/CropPanel`).
- Icons: the after-shot toolbar is `lucide-react` (`EDIT_TOOLS` in `create.after-shot.index.tsx`).
  `aftershot-icons.tsx` holds hand-rolled SVGs only for glyphs lucide lacks (today just `TrimIcon`,
  unused since the studio button became a clapperboard); they take lucide's props, so either kind
  drops into the same tool list.
- **Any route or panel with a text input calls `useLockedViewport()`**
  (`@/hooks/use-locked-viewport`) so the mobile keyboard overlays instead of pushing the page up.
- The route→route media handoff is an in-memory module variable (`src/lib/capture-handoff.ts`), not
  storage — see the root `CLAUDE.md`. `src/lib/after-shot-context.ts` is the React context the edit
  sub-routes consume.
- Media helpers live in `src/lib/`: `crop-rect.ts` (fractional crop-as-intent type, composed on
  re-crop, baked once at export — see `after-shot-export.ts`), `filter-media.ts`, `video-trim.ts`
  (still the lossless-remux fast path the studio falls back to), `layer-bake.ts`, `canvas-filter.ts`,
  `after-shot-layers.ts`, `after-shot-export.ts`. Encode/decode goes through **`mediabunny`**
  (client-side, in `video-trim.ts` / `after-shot-export.ts`) — note this is the media library,
  unrelated to Bunny.net.
- **Crop is intent, not a bake.** `CropPanel` only ever proposes a `CropRect` up to
  `create.after-shot.index.tsx`, which keeps it — with the filter and adjust — in the layout's
  `edits` (`after-shot-context.ts`); it doesn't touch `media.blob`. The live preview simulates the crop
  with CSS (shift + scale the still-uncropped `<img>`/`<video>`, clipped by the media box's
  `overflow:hidden`) so cropping, filtering, and layering all still cost exactly one encode
  generation together, at export. Don't reintroduce an eager `cropPhotoBlob`/`cropVideoBlob`-style
  helper — that pattern was deliberately removed.
- **Next writes `output`, never `media`.** `media` stays the untouched capture (or the studio's
  render); the composite goes to `setOutput` and publish reads `output ?? media`. Writing the
  composite over `media` is what made Back from publish show baked captions under live ones and
  bake them a second time.
