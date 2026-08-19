---
name: media-export-pipeline
description: How Oakmonte turns a camera capture plus filters, text, drawings and stickers into a finished post — the single-pass composite in after-shot-export.ts, the shared canvas bake, why CSS filters are reimplemented as color matrices, fractional layer geometry, and mediabunny encode/trim constraints. Use when changing export, filters, crop, trim, layer rendering, adding a new after-shot editing tool, or debugging output that is misaligned, wrongly tinted, out of sync, low quality, or fails to encode on iOS.
---

# Media export pipeline

The rules here are cross-file invariants. Each file explains itself well locally, but the ways this
pipeline breaks all come from editing one file in isolation — so this is the set of things that are
true *between* files.

## One pass, from the untouched capture

`src/lib/after-shot-export.ts` is the single place a finished post is produced. Filter, text, drawings
and stickers all land on the frame in one composite pass.

This is deliberate and it is the invariant most worth protecting. The earlier design called a helper
per tool, each decoding, re-encoding and returning a new blob — so a filtered and captioned clip went
through three generations of lossy re-encode before anyone saw it, and choosing a second filter
re-filtered already-filtered pixels. Compositing once from the original capture costs one generation no
matter how many edits stack.

So when adding a new editing tool: it contributes to the composite, it does not get its own
export-and-hand-back-a-blob helper. If you find yourself writing `applyXToBlob(blob)` and feeding its
output into another such function, that's the regression.

`exportComposite()` is what the Next button calls — it owns the photo/video branch so routes don't have
to know which encoder path applies. Add new entry points there, not in the route.

**Order within the pass: filter first, layers second.** A caption must not get tinted by the filter
underneath it. This mirrors the preview, where the CSS filter sits on the media element and the layer
overlay sits above it — get the order wrong and export stops matching what the user approved.

## The bake is shared, and must stay pure

`src/lib/layer-bake.ts` does canvas rendering only — no blob handling, no encoding. That's what lets
the photo path and the video path composite through identical code instead of drifting into two
subtly different renderers.

Keep blob/encode logic out of it. If a change seems to need I/O in the bake, it belongs in
`after-shot-export.ts` instead.

## Geometry lives in exactly one file

`src/lib/after-shot-layers.ts` holds every constant that decides where a glyph lands —
`TEXT_LAYER_WIDTH_FRACTION`, `TEXT_LAYER_LINE_HEIGHT`, box padding, radius, shadow offsets. It is
consumed by **both** sides: the live preview (`LayerOverlay`'s CSS transforms, `renderLayerContent`)
and the bake.

Layer coordinates are fractions, not pixels — `x` and `y` are 0–1 of media width/height, `fontSize` is
a fraction of container width. That's what makes a layer positioned on a phone preview land in the same
place in a full-resolution export.

Hard-coding a pixel value on either side, or tweaking a constant for the preview only, produces the
classic bug: text sits correctly on screen and lands somewhere else in the exported file. If you change
a number, change it in `after-shot-layers.ts` and let both sides read it.

## Never use `ctx.filter`

`src/lib/canvas-filter.ts` reimplements CSS filter functions as 3×3 color matrices applied via
`getImageData` / `putImageData`. This is not someone reinventing the wheel — Safari/iOS WebKit's
`CanvasRenderingContext2D.filter` silently no-ops or partially applies combined filter strings, while
`drawImage` plus pixel math behaves identically everywhere.

Given that most of your users are on mobile, a filter that works in desktop Chrome and no-ops on iPhone
is a bug that ships. Route new filter work through `compileFilter` / `applyCompiledFilter`, and note
`IDENTITY_FILTER` — both the photo and video paths skip the pixel loop entirely when the compiled
filter is identity, which is worth preserving for performance.

## Video specifics (mediabunny)

Encode/decode goes through **`mediabunny`** — a client-side media library. Unrelated to Bunny.net
despite the name; don't conflate them when reading or writing code here.

**Codec selection is container-constrained.** `getFirstEncodableVideoCodec` is asked only for codecs the
output container can actually hold. Requesting VP8-in-MP4 produces a file nothing will play.

**Audio passes through as encoded packets, never re-encoded.** Nothing on this screen edits sound, so
decoding and re-encoding would spend a generation of quality for nothing. If the capture's audio codec
can't live in MP4, the track is dropped rather than failing the export — a silent post beats no post.
Preserve that fallback.

**Timestamps come from the source frame, not from index × FPS.** Phone cameras and `MediaRecorder`
produce variable-frame-rate output; encoding against real presentation timestamps is what keeps video
aligned with audio. Output frame rate matches the capture path's 30fps so timestamps stay honest
without interpolation.

### Trimming

`src/lib/video-trim.ts` wraps mediabunny's `Conversion` API — lossless remux by default, transcoding
only when the container/codec combination forces it. Trim handles snap to real keyframes via
`getVideoKeyframes` / `snapToNearestKeyframe`, because cutting at a non-keyframe is what turns a
lossless remux into a broken clip.

One concrete mediabunny constraint, already paid for once: pass **`verifyKeyPackets` only, never
together with `metadataOnly`**. The library rejects the pair ("cannot be enabled together") — verifying
requires reading the packet body, and `metadataOnly` is precisely the request not to. Passing both
threw on every call, which left duration at 0 and the trim screen stuck on "0.0s selected" with Confirm
permanently disabled. Verification is the half worth keeping: some containers flag packets as
keyframes when they aren't.

## Capture handoff

Captured media reaches the edit screen through an in-memory module variable
(`src/lib/capture-handoff.ts`), not session or local storage — the payload is a `Blob`, and client-side
navigation never reloads the page so a module variable survives the trip.

Accepted consequence: hard-refreshing `/create/after-shot/edit` drops the pending capture and falls
back to `/create`. That's known, not a bug to fix by moving to storage.

`src/lib/after-shot-context.ts` is the React context the edit sub-routes consume once the handoff has
happened.

## Related

Panel and toolbar conventions for the after-shot UI (the `CameraPanel.tsx` shape, icon sourcing, the
`useLockedViewport()` rule for any surface with a text input) live in
`src/components/camera/AGENTS.md`, which loads automatically when working in that directory.
