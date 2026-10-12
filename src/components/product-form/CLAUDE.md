# Product-form UI conventions

The seller-facing product form (`src/routes/store.products_.new.tsx` + this directory) follows a
deliberate mobile pattern. Match it rather than inventing per-screen styling.

- Reuse the primitives in `ui.tsx` (`TextField`, `PriceField`, `StubRow`, `ExpandRow`) before writing
  new styled inputs or rows.
- **Rows, not chips, for anything selectable in a list.** Full-width rounded-`xl` rows: optional
  leading swatch/icon, label, trailing check circle on the right. Chips are only for compact
  secondary pickers (e.g. option-name presets).
- **Selected state is black.** Chips: `bg-black text-white border-black`. Rows: `border-black
bg-gray-50` plus a filled black check. There is no accent color anywhere in this form.
- Section headers `text-[15px] font-semibold text-gray-900`; hints `text-xs text-gray-400`; inputs
  `rounded-xl px-4 py-4 focus:border-gray-400`.
- Section breaks are an 8px gray bar: `border-b-8 border-gray-50` between page sections, or
  `-mx-4 h-2 bg-gray-50` to split segments inside a full-screen sheet.
- **Always offer one-tap _and_ typing** in the same view — curated presets plus a free-text input, no
  mode toggle. Typed values pin above the presets so they survive a preset-list swap.
- **Full-screen editors are pages, not fixed layers.** Wrap them in `PageSheet`
  (`@/components/PageSheet`): it hides the app underneath while open, so the editor _is_ the page
  and scrolls like one, gives it a history entry (the back gesture closes it), and restores the
  form's scroll on close. Inside: Cancel / title / Save header `sticky top-0 z-20`, a `flex-1`
  body, and any action bar `sticky bottom-0 z-20`. Don't use `useLockedViewport` /
  `useVisibleViewport` in them, and don't go back to `fixed inset-0` — a fixed layer over a
  scrolling page is what the iPhone keyboard kept breaking. Small bottom menus without text input
  (status, actions, confirm dialogs) stay fixed overlays.
- The one exception is a bar that must ride on the keyboard (DescriptionSheet's toolbar): fixed to
  the bottom, lifted by `useVisibleViewport().keyboardHeight`, hidden while the page scrolls (iOS
  reports the keyboard a frame late, so it trails mid-scroll). Only that bar is fixed, never the page.

Variants are built and working: `VariantMatrixBuilder.tsx` owns the options list and generated matrix
(with "Apply to all" bulk price/stock); `OptionEditorSheet.tsx` is the full-screen option editor
(preset names, per-name one-tap values, real color swatches, switchable size systems, search-or-create
value input, duplicate-name guard, a typed-numeric-entry row for Weight/Volume — see below). The size
chart (`size-chart/`, `SizeChartSheet.tsx`) is also built and real — see root `CLAUDE.md`'s pre-launch
note only for chart _image coverage_ gaps, not "is this built."

## Weight/Volume option → final variant page

A row's Weight/Volume option value (e.g. "0.2 g") pre-fills that row's Weight box on the last variant
page, via `VariantMatrixBuilder.weightGramsFromCombo` → `parseWeightVolumeValueToGrams`
(`weight-estimate.ts`). **Never `Math.round()` that function's result to a whole integer** — "g" has a
1:1 unit multiplier, so rounding to the nearest integer silently zeroes any value under 0.5 (a real
shipped bug: "0.2 g" → 0). Round to 2 decimal places instead; that still cleans up oz/lb's messy
floating-point conversion noise without destroying an intentional sub-gram value. `weight_grams` is
unconstrained `numeric` in the DB, so a decimal persists fine.

Price and Cost price on the last variant page (and in the bulk "Apply to all" box) open the shared
`PricingSheet` popup, same interaction as Inventory — not plain text inputs. Don't revert to a bare
`<input>` for these.

## "Apply to all" bulk inventory

`VariantCombinationsSheet.tsx` splits the bulk Inventory pick into two separate booleans:
`hasBulkLocationPick` (at least one location was actually chosen) and `hasBulkInventoryPick`
(`hasBulkLocationPick`, OR `continueSellingOutOfStock` is explicitly `true`). This split exists because
`InventorySheet`'s X button commits the same as Save — opening the bulk sheet and immediately backing
out produces a real, non-null `InventoryValues` with nothing actually chosen, indistinguishable at the
data level from a deliberate "no locations, but keep selling out of stock" save. Applying
`locationQuantities` on Apply is gated on `hasBulkLocationPick` alone (an empty object would wipe every
selected row's real stock); applying `continueSellingOutOfStock` is gated on the wider
`hasBulkInventoryPick`, since `false` can't be told apart from "untouched" the same way `true` can. Keep
these two checks separate if you touch this again — collapsing them back into one reintroduces either
the wipe bug or drops the deliberate no-location case.

## Variant "create a location mid-flow" return navigation

Creating a pickup location from inside the variant wizard's Inventory sheet must land back on the
_same_ Inventory sheet. Two shipped bugs, two rules:

- **The child that needs the handoff consumes it.** `VariantInventoryContext`
  (`product-draft-handoff.ts`) is cleared via `onInventoryContextConsumed`, fired from
  `VariantMatrixBuilder`'s own mount effect. It only mounts once `storeId` resolves, so a page-level
  `useEffect(..., [])` cleared the handoff before anything could read it (the feature was silently
  dead). Use the same pattern for any other side-trip-and-return flow.
- **Uncommitted sheet edits travel with the side-trip.** `InventorySheet`'s edits only reach `rows`
  via its Save button, and "+" (new location) skips Save. So `onCreateLocation` passes its current
  `InventoryValues` up (`(current) => void`), carried as `pending` on the context (or
  `pendingRegular` for non-variant products), and `handleCreateLocation` folds it into the stashed
  draft synchronously. A `setRows` just before wouldn't work: state updates don't reach that
  handler's closure. Thread any new `InventoryValues` field, or any new side-trip out of a sheet
  with local state, the same way.

## Necessities checklist — where each answer actually lives

`NecessitiesSheet.tsx` is a checklist, and every row has to write somewhere the save path really
persists. The schema decides that, not the UI:

| Param    | Regular product         | Variant product                                                 |
| -------- | ----------------------- | --------------------------------------------------------------- |
| Color    | not listed at all       | the `Color` option axis — **no `color` column exists anywhere** |
| Material | `material` (one column) | each selected row's `material` (`product_variants.material`)    |
| Weight   | `regularWeightGrams`    | each selected row's `weightGrams`                               |
| Size     | `manualSize`            | measurements per Size axis value                                |

Two traps this cost real bugs to learn:

- **The product-level `material` field is never persisted for a variant product.** `product-save.ts`
  only writes `payload.material` inside its `kind === "regular"` branch. So a Material picker that
  calls `onChangeMaterial` on a variant product looks like it worked and silently saves nothing —
  it has to write per-row instead (`saveMaterial`). With no combinations built yet there's no row to
  write to at all, which is why that case shows a note rather than opening the picker.
- **The auto weight estimate reads material from three places, in order** — a `Material` option axis,
  then the row's own `material`, then the product-level `material` (`estimateWeightForRow`, in both
  route files). The middle one is easy to leave out and the omission was invisible: a seller who
  answered Material on the checklist got no estimate and no explanation. Any new place material can
  be stored has to be added here too.
- **`estimateWeight` returns a reason, never a bare `null`** (`WeightEstimate` in `weight-estimate.ts`).
  The "Estimate weight" button in `WeightSheet` is always rendered; tapping it with no estimate
  available shows that reason. Hiding the button on `null` — the old behaviour — collapsed five very
  different situations (no chart for the category, an unmodelled shape, a missing measurement, no
  material, an unestimable material) into the same blank space. If you add a bail-out branch, give it
  a reason string written for a seller to read, and add a case to `weight-estimate.test.ts` — the
  strings tell people which thing to go and fix, so a wrong branch sends them to the wrong screen.
- **Every guide is estimated**: `build()` in `weight-estimate.ts` models each shape as what ships
  (fabric, lining, fill, notions), not the fabric bought to cut it, and `REQUIRED_MEASUREMENTS` is a
  full `Record` over the guide union, so a new guide fails typecheck until it has an entry. Accuracy
  is pinned by the "reference garments" tests: real weighed garments with a min-max range. Re-run them
  after touching any ratio, GSM or notions figure; widen a range only with a real garment to justify it.
  A bare fibre ("cotton") takes a garment-dependent weight (`FabricContext`): jersey on a tee, twill on
  trousers, fleece on a hoodie.
- **Color and Material can already be answered as real variant option axes**, and that editor is the
  richer one. Those rows report ("already set from your variant options") instead of opening a second
  screen over the same values — `ownedByVariantEditor` in `NecessitiesSheet.tsx`. Its threshold is
  **per param, and must stay that way**: Color is owned at 2+ axis values, Material at 1+. `ColorSheet`
  writes the Color axis itself (exactly one value), so a one-value axis is its own output — gating it
  at 1 meant a seller who set a colour from the checklist could never change it, and was told to edit
  it in variant options they had never opened. `MaterialSheet` writes per-row `material` and never the
  axis, so any Material axis is someone else's data and reopening would leave axis and rows disagreeing.

Colour and material vocabularies live in `lib/color-options.ts` / `lib/material-options.ts`, not in
`OptionEditorSheet.tsx`, so the Necessities pickers share the exact lists the variant editor uses. They
can't move back into that component: a non-component export alongside a component export breaks Fast
Refresh.

`MATERIAL_GROUPS` is grouped (Fabrics / Leather & synthetics / Metals & gemstones
/ Art, craft & home) rather than category-scoped, so a slightly-wrong category never hides the right
word and there's no category→group map to keep in step with `categories.ts`. `MATERIAL_PRESETS` is
derived from it flat, for `OptionEditorSheet`.

Preset search goes through `lib/fuzzy-search.ts` (`fuzzyFilter`), not `includes` — "chifon" and
"polyster" have to find the real preset, because an empty result pushes a seller into a one-off
spelling the GSM table won't recognise. Its typo budget is capped at 2 edits and is zero under four
characters; both limits exist because a looser version matched "vibranium" to "Titanium" and "red" to
"Bed". Reuse it for any other preset list rather than hand-rolling a filter.

## One colour, one material — from the checklist

`ColorSheet` and `MaterialSheet` each pick exactly **one** value. Reaching either means the seller did
not build that axis in the variant editor, so the assumption is that every variant shares the answer:
these screens ask "what colour/fabric is it", not "which do you sell". `ColorSheet` used to be
multi-select with a footer warning, which meant a checklist row could silently turn a size-only
product into a size x colour matrix — a much bigger decision than that row looks like. A seller who
genuinely sells several adds the axis in the variant editor, the screen that shows what it costs.

Tapping the chosen row again clears it. For Color that is the only way to undo, since `saveColors([])`
removing the axis is what keeps a one-value Color axis off a product that never wanted one.

## One picker, two screens

`value-picker.tsx` owns the two building blocks every value list in this form is made of: `SystemMenu`
(the genre/unit pill) and `ValueRow` (the full-width selectable row). `OptionEditorSheet` and the
Necessities `MaterialSheet` both render them, because they ask the same question over the same
vocabulary from two entry points. MaterialSheet briefly had its own wrapping-chip layout instead, and
it read as a different feature over a different list — if you need the picker somewhere else, import
these rather than restyling a copy.

**Material is a systemed option, but its systems do not lock.** `OPTION_SYSTEMS` now carries
`Material: MATERIAL_SYSTEMS` (the five genres), so it gets the same switcher Size and Weight/Volume
have. It is deliberately absent from `EXCLUSIVE_SYSTEM_OPTIONS`, which is what gates the locking —
once a value is picked, an exclusive option disables every other system, forbids free text outside
`Custom`, and confines search to the active system. That is right for Size and Weight/Volume, where
the systems are rival notations for one thing and "S" alongside "UK 12" is nonsense. It is wrong for
Material, whose genres are shelves in one vocabulary: "Canvas or Leather" and "Brass or Pearl" are
ordinary products that straddle two genres. So Material's switcher is a browsing aid only — browse
inside a genre, search across all of them, free-type anything, any time.

Two traps that follow from that split, both already paid for:

- `CUSTOM_SYSTEM` only appears in `systemKeys` while locked, so it is not a valid landing spot for a
  non-exclusive option. The `selectedSystems` seeding has to fall back to the option's default genre
  instead — seeding Material to `"Custom"` pins it to a genre missing from its own menu, whose
  `systemValues()` is empty by definition, and reopening showed a phantom pill above an empty list.
- Anything new gated on "has the seller picked a value yet" must use `systemsLocked`, not `hasChosen`.
  They were the same expression until Material arrived and they stopped being.

**The picker's spellings are load-bearing.** `guessGsmForMaterial` matches by substring, so a preset
must literally contain its GSM keyword — "Pique", never "Piqué"; "Cotton rib", not "Rib knit". Get it
wrong and the material still saves fine, the weight estimate just silently says it doesn't know that
fabric. A test asserts every fabric-group preset resolves; keep it passing when you add one. Non-
textiles (metals, clay, hide) resolving to nothing is correct, not a gap — those categories have no
size chart, so the estimate stops earlier anyway.

## Adding an option axis must not blank the matrix

A row's key is its option values joined (`buildKey`), so adding an axis rekeys every existing row at
once — `"Small"` becomes `"Small|Black"`. The regeneration effect in `VariantMatrixBuilder.tsx` used to
miss all of them on its exact-key lookup and rebuild blank rows, wiping every price, stock count and
image already entered. It now falls back to inheriting from an old row whose values are all still
present in the new combo (one old row seeds each of the N rows it split into). `weightGrams` is the one
field that can't carry over blindly — adding a Weight/Volume axis is precisely the inheritance case, and
that axis exists to pre-fill Weight — so it's `existing.weightGrams ?? weightGramsFromCombo(combo)`.

## Delete confirmations

`AlertDialog` (mobile-styled: `rounded-full` actions, `max-w-[92vw] rounded-2xl` content) guards
deleting a variant option (`VariantListSheet.tsx`) and deleting a location (`LocationSheet.tsx`, which
also fetches and names the affected `product_variant_stock` count before confirming). Match this
pattern for any other destructive action added to the form.

## Barcodes

All six `BarcodeType`s (`barcode-types.ts`) go through entry, save and load uniformly (traced
2026-09-09). The one deliberate asymmetry: camera auto-detect (`BarcodeScanSheet.tsx`) only picks
`ean`/`isbn` (978/979 prefix) and `upc`, the types with a scannable symbology. `gtin`/`asin` are
manual-only by design, not a gap.

## DescriptionSheet (product + collection description)

Bold cycles off → 600 (outlined) → 900 (filled) → off (`cycleBold`). Inter `900` must stay loaded in
`__root.tsx` or the heavy level silently renders as 700. The sanitizer allows exactly those two
weights (`FONT_WEIGHT_STYLE` in `sanitize-html.ts`), not general `style`.

**Format buttons only affect text typed from here on; they never reformat existing text.** An
earlier fix expanded the selection and toggled the whole element off, which reformatted typed text
and left a selection the next keystroke typed over. Both helpers in `DescriptionSheet.tsx` only move
the caret:

- `escapeFormatIfCollapsed(tagSelector)`: turning a format off from a collapsed cursor. `execCommand`
  leaves the caret inside the `<u>`/`<i>`/`<b>`, and `Range.insertNode` lands inside it too, so the
  caret is moved to the element's next sibling via a zero-width-space marker.
- `insertBoldRunAtCaret(weight)`: always a new `<b>` with an inline weight at the caret, never a
  restyle of the `<b>` the caret is in (that would change already-typed text).

`cycleBold` steps off `formats.bold` (React state), not the DOM: three taps with no typing leave no
`<b>` to inspect. A real (non-collapsed) selection is the one case that restyles existing text
(`setBoldWeightOnSelection`). `stripEditorArtifacts` removes the markers and empty format tags on
Save. Route any new toggleable format's off-transition through `escapeFormatIfCollapsed`.

Toolbar buttons expand their hit area with `before:-inset-1.5` only; they sit 2px apart.

## Autosave clearing: clear synchronously at the Save call site

`startProductSave` (`product-save.ts`) is fire-and-forget; `writeProduct` on both pages navigates
away immediately. Its own autosave clear runs only after the DB writes finish, seconds later for a
variant product, so tapping "+" in that window restored the just-saved draft (shipped bug). Both
`writeProduct`s call `clearAutosavedDraft(...)` synchronously before `navigate()`. Keep that; the
deferred clear is only a backstop.
