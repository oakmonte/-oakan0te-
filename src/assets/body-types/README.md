# Body type reference sheets

Source artwork for the body-type picker in `src/routes/find-your-fit.tsx`. The three
`female-chart-*.webp` sheets are kept for provenance and future re-cropping — nothing imports
them directly. Every other file in `female/` **is** imported by the route; each is one figure
cropped out of a source image, no re-tracing.

Every `FEMALE_BODY_TYPES` entry is image-based now. Nothing in `MALE_BODY_TYPES` has source
art yet — see Known gaps.

## How a crop becomes an option

Each figure was located by scanning its source image for ink (non-white pixels, threshold
`r<240||g<240||b<240` with `alpha>10`) to find a tight bounding box — for the multi-figure
sheets, column then row extent, separating the drawing from the caption text below it — then
cropped via canvas with 5%/3% padding and re-exported at ~300px wide as WebP, quality 0.92.
There's no saved script for this — it was written ad hoc per crop and never committed;
reproduce the approach above rather than looking for a script in git history.

Source images have inconsistent raw dimensions and aspect ratios (the sheets are landscape
multi-figure scans; the two standalone plus-size pastes were portrait, and not the same
portrait ratio as each other). This doesn't matter: `ImageBodyOption` in `find-your-fit.tsx`
renders every crop with `object-contain` inside a fixed `w-32 h-56` box, so mismatched source
aspect ratios never distort or crop the figure. Don't try to normalize source dimensions before
cropping — just find the ink and crop tight.

## Code-side ids and labels

Filenames don't appear in `find-your-fit.tsx` — each is imported and wired into
`FEMALE_BODY_TYPES` with its own `id` (used for the `bodyType` state value) and display
`label`. Mapping, in the array's actual render order:

| File | `id` | `label` |
| --- | --- | --- |
| `plus-moderate.webp` | `f-plus-moderate` | Plus Size, Moderate |
| `skinny.webp` | `f-skinny` | Skinny |
| `slim.webp` | `f-slim` | Slim |
| `medium.webp` | `f-medium` | Medium |
| `pear-small-thighs.webp` | `f-pear-small-thighs` | Pear Bust, Small Thighs |
| `pear-bigger-thighs.webp` | `f-pear-bigger-thighs` | Pear Bust, Bigger Thighs |
| `smallbust-bigger-thighs.webp` | `f-smallbust-bigger-thighs` | Small Bust, Bigger Thighs |
| `extra-large-bust.webp` | `f-extra-large-bust` | Extra Large Bust |
| `curvy.webp` | `f-curvy` | Curvy |
| `athletic.webp` | `f-athletic` | Athletic |
| `plus-fuller.webp` | `f-plus-fuller` | Plus Size, Fuller |

`MALE_BODY_TYPES` ids (`m-skinny`, `m-regular`, `m-athletic`, `m-muscular`, `m-solid`,
`m-chubby`, `m-fat`, `m-fattest`) are unchanged from before this migration — listed here only
so a future contributor adding `male/` crops knows what ids to match up with which traced
shape, without having to read the full route file.

## Sheet contents

`female-chart-1-slim-medium-pear.webp` — figures 1-4

| # | Sheet label | Cropped as |
| --- | --- | --- |
| 1 | Slim | `slim.webp` |
| 2 | Medium | `medium.webp` |
| 3 | Pear bust, small thighs | `pear-small-thighs.webp` |
| 4 | Pear bust, bigger thighs | `pear-bigger-thighs.webp` |

`female-chart-2-smallbust-muscular-skinny.webp` — figures 5-7

| # | Sheet label | Cropped as |
| --- | --- | --- |
| 5 | Small bust, very bigger thighs | not used — sheet 3's version is cleaner, see below |
| 6 | Muscular | **not used, see Known gaps** |
| 7 | Skinny | `skinny.webp` |

`female-chart-3-curvy-athletic-muscular.webp` — figures 5-9

| # | Sheet label | Cropped as |
| --- | --- | --- |
| 5 | Small bust, very bigger thighs | `smallbust-bigger-thighs.webp` |
| 6 | Extra large bust | `extra-large-bust.webp` |
| 7 | Curvy | `curvy.webp` |
| 8 | Athletic | `athletic.webp` |
| 9 | Muscular | **not used, see Known gaps** |

**The numbering across sheets does not agree.** Sheets 2 and 3 both start at 5 and then
diverge — sheet 2 has Skinny at 7, sheet 3 has Curvy. Match figures by label, never by number.
Sheet 3 is the longer and later of the two, and its version of figure 5 was used over sheet 2's.

`plus-moderate.webp` and `plus-fuller.webp` did not come from any of the three sheets above —
they're standalone single-figure images the user pasted directly into chat (no accessible file
path for a pasted-in-chat image; recovered via the OS clipboard immediately after each paste),
cropped the same way. No sheet file is kept for either; the raw pastes weren't saved anywhere
retrievable, only the finished crops. `plus-fuller` is the figure with more belly fat;
`plus-moderate` has a straight torso leading to bigger hips — that's the distinction the user
gave, not something visible from the filenames alone.

## Known gaps

- **Neither sheet's "Muscular" figure (chart 2 #6, chart 3 #9) was usable.** Both are drawn
  with a flat, pec-and-abs male chest — no breast forms — despite sitting on a chart otherwise
  full of female figures. `f-muscular` was removed from `FEMALE_BODY_TYPES` outright rather
  than shipped with a wrong or placeholder figure. Add it back once real female-presenting
  reference art exists.
- **`male/` is empty — no reference art exists for men at all.** All eight `MALE_BODY_TYPES`
  entries are still the original hand-traced `TracedBodyShape` data. `TracedBodyShape` /
  `TracedBodySilhouette` are kept in the route specifically because those eight entries still
  depend on them — don't delete that machinery until real male reference art replaces them.
- **The neutral/"Other" gender option and its five parametric silhouettes are gone from the
  app entirely** (not just unused — `NEUTRAL_BODY_TYPES`, `ParametricBodySilhouette`, and
  `ParametricBodyShape` were deleted from `find-your-fit.tsx`). Body type is Female/Male only
  now. Don't re-add a parametric fallback without discussing it first.
