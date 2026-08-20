# Body type reference sheets

Source artwork for the body-type picker in `src/routes/find-your-fit.tsx`. The three
`female-chart-*.webp` sheets are kept for provenance and future re-cropping — nothing imports
them directly. The individual files alongside them (`skinny.webp`, `slim.webp`, etc.) **are**
imported by the route; each is one figure cropped straight out of a sheet, no re-tracing.

## How a crop becomes an option

Each figure was located on its sheet by scanning for ink (non-white pixels) to find its
column, then its row extent — separating the drawing from the caption text below it — then
re-exported at ~300px wide with a small margin. See the git history for the exact script if
you need to add another crop from these same sheets.

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

## Known gaps

- **Neither sheet's "Muscular" figure (chart 2 #6, chart 3 #9) was usable.** Both are drawn
  with a flat, pec-and-abs male chest — no breast forms — despite sitting on a chart otherwise
  full of female figures. `FEMALE_BODY_TYPES` still carries the old hand-traced `f-muscular`
  entry (a `TracedBodyShape`, not cropped from these sheets) as a placeholder until a proper
  female-presenting muscular figure exists. That placeholder itself doesn't match either
  sheet's line weight or proportions well — it needs real reference art, not just a decision.
- **`f-plus-moderate` and `f-plus-fuller` are not on any of these sheets** and are drawn in a
  visibly different style (heavier line, different hands and head). Both still render from the
  old hand-traced `TracedBodyShape` data — no image crop exists for either.
- **`male/` is empty — no reference art exists for men at all.** All eight `MALE_BODY_TYPES`
  entries are still the original hand-traced `TracedBodyShape` data. `TracedBodyShape` /
  `isTraced` / `TracedBodySilhouette` are kept in the route specifically because these three
  female entries and all eight male entries still depend on them — don't delete that machinery
  until real reference art replaces the last of them.
