import { useRef, useState } from "react";
import type { WeightEstimate } from "@/lib/weight-estimate";
import { Check, ChevronLeft, ImageIcon, X } from "lucide-react";
import type { VariantOption, VariantRow } from "./VariantMatrixBuilder";
import { weightVolumeValueOf, hasWeightVolumeAxis } from "./variant-combinations";
import { stockTotal } from "./variant-stock";
import { ImageGallery } from "./ImageGallery";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import type { PickedMedia } from "./MediaPickerSheet";
import { ImageSourceSheet, type ImageSource } from "./ImageSourceSheet";
import { InventorySheet, type InventoryValues } from "./InventorySheet";
import { WeightSheet } from "./WeightSheet";
import { PricingSheet } from "./PricingSheet";
import { useMultiFilePicker } from "@/hooks/use-file-picker";
import { startBackgroundUpload, onBackgroundUploadDone } from "@/lib/background-upload";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { cleanPriceDigits, displayPriceWithCommas, padPriceOnBlur } from "@/lib/format-price-input";
import type { VariantInventoryContext } from "@/lib/product-draft-handoff";

// Swaps a background-upload preview url for its real one wherever a row is
// still holding it -- shared by both the per-row and bulk upload-done
// callbacks below, since a bulk-applied preview can end up sitting in every
// selected row (see the bulk callback's own comment for why that path needs
// this too, not just a bulkImages patch).
function swapImageInRow(row: VariantRow, previewUrl: string, url: string): VariantRow {
  if (row.mainImageUrl === previewUrl) return { ...row, mainImageUrl: url };
  if (row.additionalImageUrls?.includes(previewUrl)) {
    return {
      ...row,
      additionalImageUrls: row.additionalImageUrls.map((u) => (u === previewUrl ? url : u)),
    };
  }
  return row;
}

export function VariantCombinationsSheet({
  options,
  rows,
  setRows,
  mainImageUrl,
  additionalImageUrls,
  passFeesToBuyer,
  onChangePassFeesToBuyer,
  storeId,
  onCreateLocation,
  estimateWeightForRow,
  initialInventoryContext,
  initialNewLocationId,
  onBack,
  onDone,
}: {
  options: VariantOption[];
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  mainImageUrl: string;
  additionalImageUrls: string[];
  // Product-level pricing policy. Drilled through rather than read per row:
  // one product cannot have variants that disagree about who pays the fee.
  passFeesToBuyer: boolean;
  onChangePassFeesToBuyer: (v: boolean) => void;
  storeId: string;
  onCreateLocation: (context?: VariantInventoryContext) => void;
  estimateWeightForRow: (row: VariantRow) => WeightEstimate;
  // Set together, right after returning from the "Add pickup location"
  // side-trip -- reopens the specific Inventory sheet (row or bulk) with its
  // Edit locations picker already showing, and the new location pre-checked
  // at 0 qty (rows: seeded by the page before this mounts; bulk: seeded
  // below, since bulkInventory has no persisted home to be seeded ahead of
  // time).
  initialInventoryContext?: VariantInventoryContext | null;
  initialNewLocationId?: string | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const baseImages = mainImageUrl
    ? [mainImageUrl, ...additionalImageUrls.filter((u) => u !== mainImageUrl)]
    : additionalImageUrls;
  // Has its own SKU input (per-row), so — like every other full-screen sheet
  // with a text field — needs this to stop the keyboard from dragging the
  // fixed sheet upward instead of overlaying it. Missing here was the actual
  // "variant popups pushing up" bug.
  useLockedViewport();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCompareAtPrice, setBulkCompareAtPrice] = useState("");
  const [bulkCostPrice, setBulkCostPrice] = useState("");
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkWeight, setBulkWeight] = useState("");
  // null = untouched this session (nothing to apply). Holds a real
  // InventoryValues rather than a bare number -- the seller picks actual
  // locations via the same InventorySheet a real variant row uses, not a
  // number typed into a box with no locations attached to it. Restored from
  // whatever was already toggled/checked in that sheet before the seller
  // tapped "Add pickup location" (initialInventoryContext.pending -- this box
  // itself isn't part of the persisted draft, but the in-progress sheet
  // values riding along with the location-creation side-trip are), plus the
  // just-created location pre-checked at 0.
  const [bulkInventory, setBulkInventory] = useState<InventoryValues | null>(() => {
    if (initialInventoryContext?.kind !== "bulk") return null;
    const base = initialInventoryContext.pending;
    if (!initialNewLocationId || initialNewLocationId in base.locationQuantities) return base;
    return {
      ...base,
      locationQuantities: { ...base.locationQuantities, [initialNewLocationId]: 0 },
    };
  });
  const [bulkInventoryOpen, setBulkInventoryOpen] = useState(
    () => initialInventoryContext?.kind === "bulk",
  );
  // images[0] is the main image, the rest are additional -- same shape as a
  // row's own mainImageUrl/additionalImageUrls, so applying it is a direct
  // copy rather than a reshape.
  const [bulkImages, setBulkImages] = useState<string[]>([]);
  const [bulkImagePickerOpen, setBulkImagePickerOpen] = useState(false);
  const [imagePickerKey, setImagePickerKey] = useState<string | null>(null);
  const [inventoryKey, setInventoryKey] = useState<string | null>(() =>
    initialInventoryContext?.kind === "row" ? initialInventoryContext.rowKey : null,
  );
  const [weightKey, setWeightKey] = useState<string | null>(null);
  const [priceKey, setPriceKey] = useState<string | null>(null);
  const [showPriceErrors, setShowPriceErrors] = useState(false);

  const optionNames = options
    .filter((o) => o.name.trim() && o.values.length > 0)
    .map((o) => o.name);
  const selected = rows.filter((r) => r.selected);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const missingPrice = selected.some((r) => !r.price.trim());
  // An empty locationQuantities isn't "the seller deliberately chose no
  // locations" -- InventorySheet's X button commits the same as Save (its
  // no-locations guard's only way out is "Continue anyway"), so a seller
  // who just peeked at the bulk Inventory sheet and backed out of it can
  // leave bulkInventory non-null with nothing in it. Treating that as a
  // real, deliberate pick to actually apply would silently wipe every
  // selected row's real stock -- so the location half stays gated on this.
  const hasBulkLocationPick =
    !!bulkInventory && Object.keys(bulkInventory.locationQuantities).length > 0;
  // continueSellingOutOfStock, unlike locationQuantities, defaults to false
  // -- so continueSellingOutOfStock===true is never the "just peeked and
  // left everything untouched" case above, and IS a reliable signal of a
  // deliberate choice even with zero locations picked (e.g. explicitly
  // toggling it on, then "Continue anyway" past the no-locations guard).
  // continueSellingOutOfStock===false can't be told apart from "untouched"
  // the same way, so it doesn't widen this on its own.
  const hasBulkInventoryPick = hasBulkLocationPick || !!bulkInventory?.continueSellingOutOfStock;

  // A Weight/Volume option value ("250 g") IS this variant's weight -- there's
  // nothing left to type, and a bulk-applied number would silently overwrite
  // what the seller already declared per row (rows can each carry a different
  // one). Both the bulk box and the per-row box show it read-only instead.
  const weightFromOptions = hasWeightVolumeAxis(options);

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleRow(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
  }

  function toggleAll() {
    const next = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: next })));
  }

  // Only overwrite the fields the seller actually filled in, so applying a
  // price doesn't silently wipe stock counts they already entered by hand.
  // Untouched rows they've unchecked are left alone entirely.
  //
  // Inventory is the one exception to "only touch what's filled in": once the
  // seller has gone into the real Inventory picker and hit Save there, that's
  // an explicit, complete answer to "where and how much" -- applying it as a
  // full replacement (including to rows that had no locations picked at all)
  // is what "apply to all" actually means once the input is a real picker
  // rather than a single number. SKU is deliberately not here at all: it's
  // supposed to be unique per variant, so bulk-applying one literal value
  // would hand every selected row the same SKU, which is a correctness bug,
  // not a convenience.
  function applyToAll() {
    const patch: Partial<VariantRow> = {};
    if (bulkPrice.trim()) patch.price = bulkPrice.trim();
    if (bulkCompareAtPrice.trim()) patch.compareAtPrice = bulkCompareAtPrice.trim();
    if (bulkCostPrice.trim()) patch.costPrice = bulkCostPrice.trim();
    // Additional images are only overwritten when the seller actually staged
    // more than one -- a single cover image is a normal "just set the main
    // photo" bulk-apply, and shouldn't silently wipe extra photos a row
    // already had (see the comment above re: not clobbering unfilled fields).
    if (bulkImages.length > 0) patch.mainImageUrl = bulkImages[0];
    // Skipped entirely when the Weight/Volume axis owns weight -- a stale
    // number typed before that axis existed must not clobber it now.
    if (!weightFromOptions && bulkWeight.trim()) {
      const grams = parseFloat(bulkWeight.trim());
      if (!isNaN(grams)) patch.weightGrams = grams;
    }
    // bulkImages.length >= 1 always means patch already has mainImageUrl, so
    // checking patch alone (plus hasBulkInventoryPick) already covers every case.
    if (Object.keys(patch).length === 0 && !hasBulkInventoryPick) return;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.selected) return r;
        const next = { ...r, ...patch };
        // Built per-row rather than sliced once outside the map, so no two
        // rows ever end up pointing at the exact same array instance -- an
        // in-place edit to one row's list would otherwise silently rewrite
        // every other bulk-applied row's list too.
        if (bulkImages.length > 1) next.additionalImageUrls = bulkImages.slice(1);
        // Split so a deliberate continueSellingOutOfStock toggle (which
        // survives with zero locations picked) can apply without ALSO
        // force-clearing a row's real locationQuantities to {} -- only a
        // genuine location pick does that.
        if (bulkInventory) {
          if (hasBulkLocationPick)
            next.locationQuantities = { ...bulkInventory.locationQuantities };
          if (hasBulkInventoryPick)
            next.continueSellingOutOfStock = bulkInventory.continueSellingOutOfStock;
        }
        return next;
      }),
    );
    setBulkPrice("");
    setBulkCompareAtPrice("");
    setBulkCostPrice("");
    setBulkWeight("");
    setBulkImages([]);
    setBulkInventory(null);
    setBulkOpen(false);
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-1 text-sm text-gray-500 -ml-1"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Variants
        </span>
        <button
          onClick={() => {
            if (missingPrice) {
              setShowPriceErrors(true);
              return;
            }
            onDone();
          }}
          type="button"
          disabled={selected.length === 0}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-5 text-sm text-gray-500">
          These are all the possible combinations from the options you added. You don't have to
          create all of them — uncheck the ones that don't apply.
        </p>

        <div className="px-4 pt-4 flex items-center justify-between">
          <button type="button" onClick={toggleAll} className="text-xs text-gray-500">
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-gray-400">
            {selected.length} of {rows.length} selected
          </span>
        </div>

        {/* Overview table — one column per option, scrolls sideways rather than
            squeezing every option into the phone's width. */}
        {optionNames.length > 0 && (
          <div className="mt-3 overflow-x-auto border-y border-gray-100">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 w-10" />
                  {optionNames.map((n) => (
                    <th
                      key={n}
                      className="px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap"
                    >
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.key)}
                        aria-label={`${row.selected ? "Deselect" : "Select"} ${row.options
                          .map((o) => o.value)
                          .join(" / ")}`}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          row.selected ? "bg-black border-black" : "border-gray-300 bg-white"
                        }`}
                      >
                        {row.selected && <Check size={13} className="text-white" />}
                      </button>
                    </td>
                    {row.options.map((o) => (
                      <td
                        key={o.name}
                        className={`px-4 py-3 text-[15px] whitespace-nowrap ${
                          row.selected ? "text-gray-900" : "text-gray-300"
                        }`}
                      >
                        {o.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Per-variant detail, selected rows only — no point asking for a price
            on a combination the seller just said they don't stock. */}
        <div className="px-4 py-5">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
            >
              Apply to all
            </button>
          </div>

          {showPriceErrors && missingPrice && (
            <p className="text-xs text-red-500 mb-2">
              Add a price to every variant before continuing.
            </p>
          )}

          {bulkOpen && (
            // Same card shape as a variant row below (border/rounding/padding,
            // same header-plus-image-button, same field grid) so this reads as
            // "a variant row you fill once", not a different control -- the
            // grey fill is the only thing marking it as the template rather
            // than a real one.
            <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-500">Apply to all</p>
                <button
                  type="button"
                  onClick={() => setBulkImagePickerOpen(true)}
                  aria-label="Set image for every selected variant"
                  className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-150 active:scale-90"
                >
                  {bulkImages[0] ? (
                    <img src={bulkImages[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={16} className="text-gray-400" />
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PriceMiniButton
                  label="Price"
                  value={bulkPrice}
                  onOpen={() => setBulkPriceOpen(true)}
                />
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Inventory</span>
                  <button
                    type="button"
                    onClick={() => setBulkInventoryOpen(true)}
                    className="text-base border border-gray-200 rounded-lg px-2 py-2 text-left"
                  >
                    {hasBulkInventoryPick ? stockTotal(bulkInventory!) : "Not set"}
                  </button>
                </label>
                <PriceMiniButton
                  label="Cost price"
                  value={bulkCostPrice}
                  onOpen={() => setBulkPriceOpen(true)}
                />
                {weightFromOptions ? (
                  <LockedField label="Weight" value="From options" />
                ) : (
                  <MiniField label="Weight (g)" value={bulkWeight} onChange={setBulkWeight} />
                )}
              </div>
              {weightFromOptions && (
                <p className="mt-2 text-xs text-gray-400">
                  Weight comes from your Weight/Volume option — each variant already carries its
                  own.
                </p>
              )}
              <button
                type="button"
                onClick={applyToAll}
                disabled={
                  !bulkPrice.trim() &&
                  !bulkCompareAtPrice.trim() &&
                  !bulkCostPrice.trim() &&
                  !(bulkWeight.trim() && !weightFromOptions) &&
                  bulkImages.length === 0 &&
                  !hasBulkInventoryPick
                }
                className="mt-3 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 disabled:bg-gray-200 disabled:text-gray-400"
              >
                Apply
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {selected.map((row) => (
              <div key={row.key} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {row.options.map((o) => o.value).join(" / ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setImagePickerKey(row.key)}
                    aria-label="Set variant image"
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-150 active:scale-90"
                  >
                    {row.mainImageUrl ? (
                      <img src={row.mainImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-gray-300" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PriceMiniButton
                    label="Price *"
                    value={row.price}
                    onOpen={() => setPriceKey(row.key)}
                    error={showPriceErrors && !row.price.trim()}
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">Inventory</span>
                    <button
                      type="button"
                      onClick={() => setInventoryKey(row.key)}
                      className="text-base border border-gray-200 rounded-lg px-2 py-2 text-left"
                    >
                      {stockTotal(row)}
                    </button>
                  </label>
                  <PriceMiniButton
                    label="Cost price"
                    value={row.costPrice}
                    onOpen={() => setPriceKey(row.key)}
                  />
                  {weightVolumeValueOf(row.options) ? (
                    <LockedField
                      label="Weight"
                      value={row.weightGrams != null ? `${row.weightGrams} g` : "—"}
                    />
                  ) : (
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-400">Weight</span>
                      <button
                        type="button"
                        onClick={() => setWeightKey(row.key)}
                        className="text-base border border-gray-200 rounded-lg px-2 py-2 text-left"
                      >
                        {row.weightGrams != null ? `${row.weightGrams} g` : "—"}
                      </button>
                    </label>
                  )}
                </div>
              </div>
            ))}

            {selected.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                Select at least one combination above.
              </p>
            )}
          </div>
        </div>
      </div>

      {imagePickerKey && (
        <VariantImagePopover
          initialValue={rows.find((r) => r.key === imagePickerKey)?.mainImageUrl ?? ""}
          initialAdditional={rows.find((r) => r.key === imagePickerKey)?.additionalImageUrls ?? []}
          baseImages={baseImages}
          // setRows takes a functional updater, so this always reads whatever
          // the row's images actually are at the moment the upload resolves
          // -- not a stale snapshot from when the popover was still open.
          // Only touches the row if the preview is still there, i.e. Done
          // was actually tapped with it; a row where the seller cancelled
          // (or picked something else since) never had the preview url
          // written into it, so this becomes a no-op for that row.
          onUploadStarted={(id, previewUrl) => {
            onBackgroundUploadDone(id, (u) => {
              if (u.status !== "success" || !u.url) return;
              const url = u.url;
              setRows((prev) => prev.map((r) => swapImageInRow(r, previewUrl, url)));
            });
          }}
          onDone={(url, additional) => {
            updateRow(imagePickerKey, {
              mainImageUrl: url,
              additionalImageUrls: additional.length > 0 ? additional : null,
            });
            setImagePickerKey(null);
          }}
          onClose={() => setImagePickerKey(null)}
        />
      )}

      {bulkImagePickerOpen && (
        <VariantImagePopover
          title="Image for all variants"
          initialValue={bulkImages[0] ?? ""}
          initialAdditional={bulkImages.slice(1)}
          baseImages={baseImages}
          onUploadStarted={(id, previewUrl) => {
            onBackgroundUploadDone(id, (u) => {
              if (u.status !== "success" || !u.url) return;
              const url = u.url;
              // Two places this preview can still be waiting: bulkImages
              // itself (Apply to all hasn't been tapped yet) AND every row
              // it was already copied into (applyToAll clears bulkImages
              // the moment it runs, so patching only bulkImages would
              // silently strand every row that already got the preview
              // copied into it before the upload resolved).
              setBulkImages((prev) => prev.map((img) => (img === previewUrl ? url : img)));
              setRows((prev) => prev.map((r) => swapImageInRow(r, previewUrl, url)));
            });
          }}
          onDone={(url, additional) => {
            setBulkImages(url ? [url, ...additional] : []);
            setBulkImagePickerOpen(false);
          }}
          onClose={() => setBulkImagePickerOpen(false)}
        />
      )}

      {bulkInventoryOpen && (
        <InventorySheet
          productLabel="All selected variants"
          storeId={storeId}
          hideIdentifiers
          initial={
            bulkInventory ?? {
              continueSellingOutOfStock: false,
              locationQuantities: {},
              sku: "",
              barcodes: [],
            }
          }
          onCreateLocation={(current) => onCreateLocation({ kind: "bulk", pending: current })}
          initialLocationsPickerOpen={initialInventoryContext?.kind === "bulk"}
          onSave={(values) => {
            setBulkInventory(values);
            setBulkInventoryOpen(false);
          }}
        />
      )}

      {inventoryKey &&
        (() => {
          const row = rows.find((r) => r.key === inventoryKey);
          if (!row) return null;
          return (
            <InventorySheet
              productLabel={row.options.map((o) => o.value).join(" / ")}
              storeId={storeId}
              initial={{
                continueSellingOutOfStock: row.continueSellingOutOfStock,
                locationQuantities: row.locationQuantities,
                sku: row.sku,
                barcodes: row.barcodes ?? [],
              }}
              onCreateLocation={(current) =>
                onCreateLocation({ kind: "row", rowKey: row.key, pending: current })
              }
              initialLocationsPickerOpen={
                initialInventoryContext?.kind === "row" &&
                initialInventoryContext.rowKey === row.key
              }
              onSave={(values: InventoryValues) => {
                updateRow(inventoryKey, {
                  continueSellingOutOfStock: values.continueSellingOutOfStock,
                  locationQuantities: values.locationQuantities,
                  sku: values.sku,
                  barcodes: values.barcodes,
                });
                setInventoryKey(null);
              }}
            />
          );
        })()}

      {weightKey &&
        (() => {
          const row = rows.find((r) => r.key === weightKey);
          if (!row) return null;
          return (
            <WeightSheet
              productLabel={row.options.map((o) => o.value).join(" / ")}
              initial={row.weightGrams ?? null}
              estimate={estimateWeightForRow(row)}
              onSave={(grams) => {
                updateRow(weightKey, { weightGrams: grams });
                setWeightKey(null);
              }}
              onClose={() => setWeightKey(null)}
            />
          );
        })()}

      {priceKey &&
        (() => {
          const row = rows.find((r) => r.key === priceKey);
          if (!row) return null;
          return (
            <PricingSheet
              price={row.price}
              compareAtPrice={row.compareAtPrice}
              costPrice={row.costPrice}
              onChangePrice={(v) => updateRow(priceKey, { price: v })}
              onChangeCompareAtPrice={(v) => updateRow(priceKey, { compareAtPrice: v })}
              onChangeCostPrice={(v) => updateRow(priceKey, { costPrice: v })}
              passFeesToBuyer={passFeesToBuyer}
              onChangePassFeesToBuyer={onChangePassFeesToBuyer}
              onClose={() => setPriceKey(null)}
            />
          );
        })()}

      {bulkPriceOpen && (
        <PricingSheet
          price={bulkPrice}
          compareAtPrice={bulkCompareAtPrice}
          costPrice={bulkCostPrice}
          onChangePrice={setBulkPrice}
          onChangeCompareAtPrice={setBulkCompareAtPrice}
          onChangeCostPrice={setBulkCostPrice}
          passFeesToBuyer={passFeesToBuyer}
          onChangePassFeesToBuyer={onChangePassFeesToBuyer}
          onClose={() => setBulkPriceOpen(false)}
        />
      )}
    </div>
  );
}

function VariantImagePopover({
  title = "Variant image",
  initialValue,
  initialAdditional,
  baseImages,
  onUploadStarted,
  onDone,
  onClose,
}: {
  title?: string;
  initialValue: string;
  initialAdditional: string[];
  // Photos already uploaded on the base product page — shown as a one-tap
  // pool here so a seller assigning a variant image doesn't have to
  // re-upload something that's already sitting on the product.
  baseImages: string[];
  // Fired the instant a file starts uploading (id + its object-URL preview),
  // so the CALLER -- which outlives this popover, whether the seller taps
  // Done before the upload finishes or closes the popover entirely -- can
  // independently track it and patch its own row/bulk state once it
  // resolves. This popover also does its own local swap below purely so its
  // own preview looks right while it's still open; the caller's tracking is
  // what actually makes the eventual save correct.
  onUploadStarted?: (id: string, previewUrl: string) => void;
  onDone: (url: string, additional: string[]) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState(
    initialValue ? [initialValue, ...initialAdditional] : initialAdditional,
  );
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const filePicker = useMultiFilePicker("image/*");
  const addButtonRef = useRef<HTMLButtonElement>(null);

  function openSourceSheet() {
    setAnchorRect(addButtonRef.current?.getBoundingClientRect() ?? null);
    setSourceSheetOpen(true);
  }

  function addUrls(urls: string[]) {
    if (urls.length === 0) return;
    setImages((prev) => [...prev, ...urls.filter((u) => !prev.includes(u))]);
  }

  // Uploads run in the background (background-upload.ts) and survive this
  // popover closing -- tapping Done while a file is still uploading no
  // longer risks saving a blob: preview url onto the variant; see
  // onUploadStarted above for how the eventual real url still lands.
  function uploadFiles(files: File[]) {
    for (const file of files) {
      const { id, previewUrl } = startBackgroundUpload(file, "product-image", "variant photo");
      addUrls([previewUrl]);
      onUploadStarted?.(id, previewUrl);
      onBackgroundUploadDone(id, (u) => {
        if (u.status !== "success" || !u.url) return;
        const url = u.url;
        setImages((prev) => prev.map((img) => (img === previewUrl ? url : img)));
      });
    }
  }

  async function handleSource(source: ImageSource) {
    setSourceSheetOpen(false);
    if (source === "drafts") {
      setDraftsOpen(true);
      return;
    }
    uploadFiles(await filePicker.pick());
  }

  function handlePicked(media: PickedMedia[]) {
    setDraftsOpen(false);
    addUrls(media.map((m) => m.url));
  }

  // Tapping a base-product photo adds it to this variant; tapping it again
  // (it's already in this variant's list) removes just that assignment — the
  // photo itself stays on the base product either way.
  function toggleBaseImage(url: string) {
    if (images.includes(url)) {
      setImages((prev) => prev.filter((u) => u !== url));
    } else {
      addUrls([url]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-4 w-full max-w-xs animate-in fade-in zoom-in-95 duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {filePicker.node}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} className="p-1 -mr-1">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {baseImages.length > 0 && (
          <p className="text-xs font-medium text-gray-500 mb-1.5">This image</p>
        )}

        <ImageGallery
          images={images}
          onReorder={setImages}
          onRemove={(url) => setImages((prev) => prev.filter((u) => u !== url))}
          onAddTap={openSourceSheet}
          addButtonRef={addButtonRef}
        />

        {baseImages.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1.5">From your product photos</p>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {baseImages.map((url) => {
                const selected = images.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => toggleBaseImage(url)}
                    aria-label={selected ? "Remove from variant" : "Add to variant"}
                    className="relative w-12 h-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden transition-transform duration-150 active:scale-90"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <span
                      className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-150 ${
                        selected ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <Check size={16} className="text-white" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onDone(images[0] ?? "", images.slice(1))}
          className="w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 mt-3"
        >
          Done
        </button>

        {sourceSheetOpen && (
          <ImageSourceSheet
            anchorRect={anchorRect}
            onSelect={handleSource}
            onClose={() => setSourceSheetOpen(false)}
          />
        )}
        {draftsOpen && (
          <DraftImagePickerSheet onSelect={handlePicked} onClose={() => setDraftsOpen(false)} />
        )}
      </div>
    </div>
  );
}

// Same shape as the Inventory/Weight mini-buttons -- tapping opens the real
// PricingSheet (price, compare-at, cost, fee/profit breakdown) instead of a
// bare text box, so a seller does the same price math per variant that
// they'd do for the whole product.
function PriceMiniButton({
  label,
  value,
  onOpen,
  error = false,
}: {
  label: string;
  value: string;
  onOpen: () => void;
  error?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs ${error ? "text-red-500" : "text-gray-400"}`}>{label}</span>
      <button
        type="button"
        onClick={onOpen}
        className={`text-base border rounded-lg px-2 py-2 text-left ${
          error ? "border-red-300" : "border-gray-200"
        }`}
      >
        {value.trim() ? `₦${displayPriceWithCommas(value)}` : "—"}
      </button>
    </label>
  );
}

/** Same footprint as MiniField, but read-only: a value the seller already
 *  decided somewhere upstream (today only Weight, owned by the Weight/Volume
 *  option axis). Deliberately not a disabled <input> — a greyed-out input
 *  still reads as "broken, should be typeable", where a plain filled box
 *  reads as "this is already answered". */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-base border border-gray-100 bg-gray-50 text-gray-500 rounded-lg px-2 py-2 truncate">
        {value}
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = "number",
  isPrice = false,
  error = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  /** Comma-grouped, decimal-aware price entry (same behavior as PricingSheet's
   *  PriceBox) instead of a bare type="number" input — commas typed or shown
   *  never reach `value` itself, so Number(row.price) downstream still works. */
  isPrice?: boolean;
  error?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs ${error ? "text-red-500" : "text-gray-400"}`}>{label}</span>
      <input
        type={isPrice ? "text" : type}
        inputMode={isPrice ? "decimal" : undefined}
        value={isPrice ? displayPriceWithCommas(value) : value}
        onChange={(e) => onChange(isPrice ? cleanPriceDigits(e.target.value) : e.target.value)}
        onBlur={isPrice ? () => value && onChange(padPriceOnBlur(value)) : undefined}
        className={`text-base border rounded-lg px-2 py-2 outline-none ${
          error ? "border-red-300" : "border-gray-200"
        }`}
      />
    </label>
  );
}
