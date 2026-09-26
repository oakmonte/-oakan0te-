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
- **Full-screen sheets**, not bottom drawers: `fixed inset-0 z-50 bg-white flex flex-col min-h-dvh`
  with a Cancel / title / Save header. Header and any bottom action bar are plain `shrink-0` flex
  children around a `flex-1 overflow-y-auto` body — **never `sticky`**: inside these fixed sheets it
  does nothing useful, and on iPhone it displaced headers down the screen and footers up it.
- **Any sheet containing a text input must call `useLockedViewport()`** (`@/hooks/use-locked-viewport`)
  so the mobile keyboard overlays the page instead of pushing it up. Easy to forget on new sheets;
  see `OptionEditorSheet.tsx`.

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

Creating a pickup location from inside the variant wizard's Inventory sheet (Edit locations → new
location → save) has to land back on the _same_ Inventory sheet, not the collapsed product form. The
handoff (`product-draft-handoff.ts`'s `VariantInventoryContext`) is consumed via an
`onInventoryContextConsumed` callback that `VariantMatrixBuilder` fires from **its own mount effect** —
not a `useEffect(..., [])` at the page level. `VariantMatrixBuilder` only mounts once `storeId` resolves
(an async effect of its own in `use-own-store.ts`), so a page-level effect clearing the handoff fires on
the page's own first commit, well before the component that needs the value — or the grandchild that
actually reads it — exists. Got this wrong once already (shipped a version where the whole feature was
silently dead); if you add a similar side-trip-and-return flow anywhere else in this form, use the same
child-owns-its-own-consumption pattern, not a parent-level clearing effect.

**Gotten wrong a second time, differently**: `InventorySheet`'s own in-progress edits (the toggle,
whichever locations are checked, SKU, barcodes) only ever reach the page's `rows`/`regular*` state via
that sheet's own Save button. Tapping "+" to create a new location from inside "Edit locations" does
**not** go through Save — so `handleCreateLocation`'s `stashProductDraft(currentDraft())` used to
snapshot the page's stale pre-edit copy of that row, silently dropping everything the seller had just
toggled/checked (shipped bug: came back from creating a location with only the brand-new one checked,
any stock already entered gone). Fixed by having `InventorySheet`'s `onCreateLocation` prop pass its
_current_ uncommitted `InventoryValues` up (`(current: InventoryValues) => void`, not `() => void`),
carried on `VariantInventoryContext` as `pending` for the row/bulk case, and folded directly into the
stashed draft's `rows` in `handleCreateLocation` (a plain `pendingRegular` param for the non-variant
path). It has to be folded in there, synchronously, rather than via a `setRows`/`setRegular*` call made
just before — both happen inside the same click handler, and React doesn't apply a state update to that
render's closure until after the handler returns, so a normal commit-then-stash ordering still stashes
the old value. If you add another field to `InventoryValues`, or another side-trip out of a sheet with
uncommitted local state, thread it through the same way rather than assuming "it's already in `rows`."

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
- **Shapes with no area formula**: only `turtle-neck`, because its chart measures neck height, cuff
  and hem but no `body_length`, so there is nothing to size the panels from. `REQUIRED_MEASUREMENTS`
  in `weight-estimate.ts` is the source of truth, and a test (`weight-estimate.test.ts`) asserts every
  guide in `ALL_SIZE_CHARTS` either has a formula or is on that documented exception list. That guard
  exists because the 2026-09-10 artwork batch added 19 guides with trim multipliers and images but no
  formula — typecheck, lint and build all stayed green while roughly half the catalogue (hoodies, tank
  tops, cargo pants, skirts) silently told sellers "we can't estimate this shape".
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
Refresh, and root `CLAUDE.md` caps that warning at exactly 6.

`MATERIAL_GROUPS` is grouped (Fabrics / Nigerian & African / Leather & synthetics / Metals & gemstones
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

`barcode-types.ts`'s six `BarcodeType`s (`custom`/`gtin`/`upc`/`ean`/`isbn`/`asin`) are handled uniformly
end-to-end — verified 2026-09-09 by tracing entry (`BarcodesSheet.tsx`) → save/update
(`product-save.ts`'s `barcodeInsertRows`, shared by create and the delete-and-rebuild update path) →
load (`toBarcodeType`, `store.products_.$id.tsx`) — no type-specific branching drops or mishandles any
of them, and the DB column has no constraint that would block one. The one place types are handled
_unevenly_, deliberately: `BarcodeScanSheet.tsx`'s camera auto-detection only classifies `ean`/`isbn`
(by EAN-13 prefix 978/979) and `upc`, because those are the only types with a real scannable symbology.
`gtin` and `asin` are never auto-picked — they're manual-only in the type dropdown, by design, not a
gap.

## DescriptionSheet (product + collection description)

Two-level Bold, not a plain toggle: cycles off → 600 (outlined button) → 900 (filled-black button) →
off. `cycleBold`/`currentBoldLevel` in `DescriptionSheet.tsx`. Inter must have `900` loaded in
`__root.tsx`'s font link or the heavy level silently renders identical to plain browser-default bold
(700) — it fell back invisibly once already. Sanitizer allow-list for this lives in `sanitize-html.ts`'s
`FONT_WEIGHT_STYLE` (exact `600`/`900` only, not a general "allow style" hole).

**Every format button is a pure "what happens to text typed from here on" switch — never a retroactive
edit of text already on the page.** This was gotten wrong once already: the first fix for the
collapsed-cursor toggle-off bug below _expanded the selection to the whole enclosing element and
toggled that off_, which silently reformatted already-typed text and left a non-collapsed selection
behind that the next keystroke would type over — reported back as "if I type underline, I can't switch
back." Don't reintroduce that shape of fix. The two helpers that replaced it, both in
`DescriptionSheet.tsx`, only ever move the _caret_, never touch existing nodes:

- `escapeFormatIfCollapsed(tagSelector)` — for turning a format OFF from a collapsed cursor. A plain
  `execCommand` toggle-off leaves the caret still physically inside the `<u>`/`<i>`/`<b>` element's DOM
  boundary, so the browser keeps extending that same element for whatever's typed next regardless of
  the toggled flag (reads as "the button doesn't turn off"). Inserting a plain text node at the caret
  doesn't fix it either — `Range.insertNode` at that position still lands the node _inside_ the element,
  which still inherits its style. The only real fix is moving the caret to the element's next **sibling**
  position, outside its closing tag — via an invisible zero-width-space marker (`ZERO_WIDTH_SPACE`) so
  the caret has somewhere to land.
- `insertBoldRunAtCaret(weight)` — for bold specifically, needed because two _on_ levels (600/900) exist
  and stepping between them means changing a weight, not just toggling a class. Never restyle whatever
  `<b>`/`<strong>` the caret already happens to be inside — that mutates whatever was typed under the
  previous level. Always create a brand-new `<b>` with its own explicit inline weight at the caret
  instead; an inline style always wins over an inherited one, so it's harmless if this ends up nested
  inside the old wrapper.

`cycleBold` drives its 0→1→2→0 sequence off `formats.bold` (the button's own last-known React state),
never by re-deriving from the DOM mid-cycle — tapping three times with no typing in between often has no
`<b>` element to inspect yet at all, so a DOM-derived read can't tell level 1 from level 2 in that case.
A **real** (non-collapsed) selection is the one case where restyling existing text directly
(`setBoldWeightOnSelection`) is correct — the seller explicitly selected it to act on it.

Both marker helpers leave invisible zero-width-space text nodes behind as caret anchors, cleaned up on
Save by `stripEditorArtifacts` (strips the character, then removes any b/strong/i/em/u left empty by a
tapped-but-never-typed-into format). If you add another toggleable format here, route its off-transition
through `escapeFormatIfCollapsed` or it'll have the identical "can't switch back" bug.

Toolbar buttons use an invisible `before:-inset-1.5` hit-area expansion (`ToolbarButton` in
`DescriptionSheet.tsx`) — kept modest since the buttons sit only `gap-0.5` (2px) apart; a bigger
expansion makes neighbors' hit zones collide more than it closes real dead space.

## Autosave clearing — clear synchronously at the Save call site, not in the background save

`startProductSave` (`product-save.ts`) is fire-and-forget: both `store.products_.new.tsx` and
`store.products_.$id.tsx`'s `performSave` call it without awaiting, then navigate away immediately.
`product-save.ts`'s own `run()` clears the relevant `localStorage` autosave slot, but only once the real
DB writes finish — seconds away for a variant product. That's too late: both pages now also call
`clearAutosavedDraft(...)` directly in `performSave`, synchronously, right before `navigate()`. Without
it, tapping "+" (or reopening the same product) inside that window restores the just-saved draft into
what should be a blank/fresh form — a real, shipped bug. Keep the synchronous call if you touch either
`performSave`; the deferred one in `product-save.ts` is a harmless backstop, not the actual fix.
