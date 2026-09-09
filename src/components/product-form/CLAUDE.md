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
  with a sticky Cancel / title / Save header.
- **Any sheet containing a text input must call `useLockedViewport()`** (`@/hooks/use-locked-viewport`)
  so the mobile keyboard overlays the page instead of pushing it up. Easy to forget on new sheets;
  see `OptionEditorSheet.tsx`.

Variants are built and working: `VariantMatrixBuilder.tsx` owns the options list and generated matrix
(with "Apply to all" bulk price/stock); `OptionEditorSheet.tsx` is the full-screen option editor
(preset names, per-name one-tap values, real color swatches, switchable size systems, search-or-create
value input, duplicate-name guard, a typed-numeric-entry row for Weight/Volume — see below). The size
chart (`size-chart/`, `SizeChartSheet.tsx`) is also built and real — see root `CLAUDE.md`'s pre-launch
note only for chart *image coverage* gaps, not "is this built."

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
location → save) has to land back on the *same* Inventory sheet, not the collapsed product form. The
handoff (`product-draft-handoff.ts`'s `VariantInventoryContext`) is consumed via an
`onInventoryContextConsumed` callback that `VariantMatrixBuilder` fires from **its own mount effect** —
not a `useEffect(..., [])` at the page level. `VariantMatrixBuilder` only mounts once `storeId` resolves
(an async effect of its own in `use-own-store.ts`), so a page-level effect clearing the handoff fires on
the page's own first commit, well before the component that needs the value — or the grandchild that
actually reads it — exists. Got this wrong once already (shipped a version where the whole feature was
silently dead); if you add a similar side-trip-and-return flow anywhere else in this form, use the same
child-owns-its-own-consumption pattern, not a parent-level clearing effect.

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
*unevenly*, deliberately: `BarcodeScanSheet.tsx`'s camera auto-detection only classifies `ean`/`isbn`
(by EAN-13 prefix 978/979) and `upc`, because those are the only types with a real scannable symbology.
`gtin` and `asin` are never auto-picked — they're manual-only in the type dropdown, by design, not a
gap.

## DescriptionSheet (product + collection description)

Two-level Bold, not a plain toggle: cycles off → 600 (outlined button) → 900 (filled-black button) →
off. `cycleBold`/`currentBoldLevel` in `DescriptionSheet.tsx`. Inter must have `900` loaded in
`__root.tsx`'s font link or the heavy level silently renders identical to plain browser-default bold
(700) — it fell back invisibly once already. Sanitizer allow-list for this lives in `sanitize-html.ts`'s
`FONT_WEIGHT_STYLE` (exact `600`/`900` only, not a general "allow style" hole).

**Collapsed-cursor toggle-off gotcha**: toggling a format (bold/italic/underline) via `execCommand` with
a *collapsed* selection (a bare cursor, not a text selection — the normal state right after typing a
word) only changes whether *future* typed characters get the format; it does not retroactively strip
the format from text already typed and already wrapped, even with the cursor sitting right next to it.
Reads as "the button doesn't turn off." Fixed via `selectEnclosingIfCollapsed`, which expands to the
enclosing `<b>`/`<i>`/`<u>` element before calling `execCommand` in that case. If you add another
toggleable format here, route it through the same helper or it'll have the identical bug.

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
