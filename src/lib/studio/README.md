# Studio

The multi-clip video editor behind `/create/after-shot/studio`. It replaced the old single-clip
trim screen (`create.after-shot.edit.tsx`, deleted).

UI lives in `src/components/studio/`, logic here. Read this before changing either.

## The one rule

**A `StudioProject` is plain data.** No blobs, no DOM, no decoders — just numbers and ids
(`types.ts`). Everything heavy is in the source registry and looked up by `sourceId`.

That is what makes three otherwise-hard things easy:

- undo/redo is a stack of whole-project snapshots (`project.ts`), because a snapshot is cheap;
- the exporter is a pure function of `(project, sources)`;
- the preview and the bake can be two completely different renderers that still agree.

## Preview and bake must agree

There are two renderers — DOM/CSS on screen, canvas 2D in `export.ts` — and the only thing keeping
them honest is that **neither owns any numbers**:

| Concern             | Single source of truth                                             |
| ------------------- | ------------------------------------------------------------------ |
| Colour grade        | `adjustments.ts` → one CSS filter string                           |
| Transitions         | `render.ts` `transitionFrame()` → opacity / scale / offset         |
| Vignette            | `render.ts` — `vignetteCss()` and `drawVignette()`, same constants |
| Product pins        | `render.ts` — fractions of frame width, used by both               |
| Captions / stickers | `after-shot-layers.ts` + `layer-bake.ts` (shared with after-shot)  |

`adjustments.ts` may only emit the six functions `canvas-filter.ts` implements (brightness,
contrast, saturate, grayscale, sepia, hue-rotate). Anything else renders in the preview and silently
vanishes from the export. Vignette is the deliberate exception: it is not expressible as a colour
matrix, so it is _drawn_ in both places rather than filtered.

Never use `ctx.filter` — see the root `CLAUDE.md`.

## Time model

- The **video track is gapless and ordered**. A clip stores no absolute start; its position is the
  sum of every earlier clip's on-timeline length (`clipStarts`). Trimming clip 1 cannot leave a hole
  in front of clip 2.
- A clip's timeline length is `(outPoint - inPoint) / speed`. Source seconds and timeline seconds
  are different units — mixing them up is the bug to watch for in every trim/split/beat calculation.
- **Audio floats.** An `AudioClip` stores an absolute `timelineStart`, so detaching a clip's sound
  and sliding it late is a number change. Deleting a video clip ripples the track; audio does not
  move with it (same as the reference editor).

## Transitions freeze, they don't overlap

A transition is centred on the cut and takes half its length from each side. Only one of the two
clips plays real frames; the other holds its boundary frame (outgoing's last, incoming's first).

This is a deliberate trade. A true overlapping crossfade needs frames past a clip's out point, which
often do not exist once you have trimmed to the end of a take, and it shortens the timeline every
time you add a transition. Freezing costs nothing, keeps the timeline length exactly what the track
shows, and is imperceptible at 0.3–0.4s. `export.ts` pre-decodes those boundary frames once.

## Playback: the timeline is the clock

`use-playback.ts` runs one rAF clock and every media element is slaved to it. There is no "current
video" whose `currentTime` drives anything — a clip at 0.4x, an audio chip three seconds late and a
still photo have no shared time base, so the wall clock owns position and each element is nudged
toward it. Elements inside `DRIFT_TOLERANCE` are left alone, because seeking a playing video is the
one thing guaranteed to stutter.

Each clip gets its own `<video>` (no `src` swapping, so clip changes are instant), but only a window
of ±1 around the playhead is mounted — mobile Safari caps concurrent decoders.

## Timeline: scrollLeft is the playhead

`StudioTimeline` welds the playhead to the centre of the screen and scrolls the tracks under it, so
the browser's own momentum scrolling _is_ the scrub gesture. Consequences:

- the component is `memo`'d and takes stable handles (`subscribe`/`seek`/`pause`/`timeRef`) rather
  than the `PlaybackApi` object, which is rebuilt every frame;
- `ownerRef` arbitrates between clock and finger, because a programmatic `scrollLeft` fires exactly
  the same event a swipe does.

## Export

`exportTimeline()` is one pass from the untouched sources: per-clip grade, transitions, timed
captions, pins and the whole audio mix land on each frame in a single encode.

Two fast paths come first and both hand control back to existing code:

1. **passthrough** — one untouched clip at its native aspect: return the original blob.
2. **trim only** — delegate to `video-trim.ts`, which remuxes losslessly.

Audio is mixed in an `OfflineAudioContext` (buffer sources for speed, gain nodes for volume and
fades) and added as one `AudioBufferSource`. This is the one place the studio departs from
`after-shot-export.ts`'s encoded-audio passthrough, and deliberately: that file's stated reason for
passing audio through untouched is that _nothing on that screen edits sound_. Here volume, fades,
detached tracks, added music and speed changes all do.

Performance note: the colour-matrix pass costs ~20ms/frame at 540×960, but the GPU→CPU readback it
forces costs more again — so the grading canvas is only created with `willReadFrequently` when some
clip is actually graded. Encoding dominates everything else.

## Oakmonte-specific

- **Product pins** (`render.ts`, `ProductPinOverlay`) — shoppable tags baked into the pixels so they
  survive a re-share off-platform. Titles/prices are typed for now; real store scoping exists now
  (`useActiveStoreId` in `src/hooks/use-own-store.ts`) — this should read the seller's catalogue
  through it and carry a product id.
- **Cover frame** — sets `CapturedMedia.poster`, rendered through the same grade and overlays as the
  video so the listing thumbnail is a real frame of the finished edit.
- **Aspect presets** are named by placement (Feed / Product / Grid), and the safe-area guides show
  where those crops and Oakmonte's own chrome cut into a 9:16 master.
- **Reveal ramp** (`project.ts`) — one tap for the shot every seller is trying to cut: splits around
  the playhead and drops the middle slice into slow motion.
- **Beat sync** (`audio.ts`) — energy-based onset detection, marked on the timeline, with a
  cut-on-beats action for outfit changes.
