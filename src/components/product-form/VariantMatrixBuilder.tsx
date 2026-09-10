import { useEffect, useState } from "react";
import type { WeightEstimate } from "@/lib/weight-estimate";
import { Plus, ChevronRight } from "lucide-react";
import { OptionEditorSheet } from "./OptionEditorSheet";
import { VariantListSheet } from "./VariantListSheet";
import { VariantCombinationsSheet } from "./VariantCombinationsSheet";
import { regenerateRows } from "./variant-combinations";
import type { BarcodeEntry } from "@/lib/barcode-types";
import type { VariantInventoryContext } from "@/lib/product-draft-handoff";

export type VariantOption = { name: string; values: string[] };
export type VariantOptionValue = { name: string; value: string };
export type VariantRow = {
  key: string; // values joined by "|" — stable identity across regeneration
  options: VariantOptionValue[];
  // Sellers rarely stock every combination, so each one is opt-out. Only
  // selected rows are written as variants.
  selected: boolean;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  sku: string;
  mainImageUrl: string;
  // Inventory, edited via InventorySheet -- stock_qty at save time is the
  // sum of locationQuantities, not a field anyone types into directly.
  continueSellingOutOfStock: boolean;
  locationQuantities: Record<string, number>;
  // Stock recorded before per-location inventory existed (or by importers),
  // which has no location attached yet. Kept so editing an older product and
  // saving doesn't silently zero its stock; superseded as soon as the seller
  // assigns any location quantities.
  legacyStockQty?: number;
  // Columns this form has no UI for yet (importers write them — see
  // canonical-product-schema — this form doesn't). Optional and untouched by
  // anything here; the edit page round-trips them so opening an imported
  // product in the editor and hitting Save doesn't silently drop them.
  // One-to-many now (see product_variant_barcodes) -- absent/empty means no
  // barcodes recorded for this row, not that the field was never fetched.
  barcodes?: BarcodeEntry[];
  material?: string | null;
  materialFeel?: string | null;
  weightGrams?: number | null;
  additionalImageUrls?: string[] | null;
};

// Generous rather than unlimited — variant-combinations.ts's MAX_COMBINATIONS
// is the real guard, this just keeps the option list itself sane.
export const MAX_OPTIONS = 8;

// The variant-building flow is a small wizard once at least one option
// exists: the inline row just opens it back up rather than rendering the
// full option list + combination grid inline in the scrolling product form.
type WizardStep = "list" | "combinations" | null;

export function VariantMatrixBuilder({
  options,
  setOptions,
  rows,
  setRows,
  mainImageUrl,
  additionalImageUrls,
  storeId,
  onCreateLocation,
  estimateWeightForRow,
  initialInventoryContext,
  initialNewLocationId,
  onInventoryContextConsumed,
}: {
  options: VariantOption[];
  setOptions: (fn: (prev: VariantOption[]) => VariantOption[]) => void;
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  // The photos already added on the base product page — offered as a
  // one-tap pool inside each variant's image picker instead of forcing a
  // re-upload of something the seller already has.
  mainImageUrl: string;
  additionalImageUrls: string[];
  // For InventorySheet's location list, opened per-variant from the combos
  // sheet.
  storeId: string;
  // Optional context: set when the seller is mid-"Add pickup location"
  // side-trip out of one of the combos sheet's Inventory sheets (a specific
  // row, or the bulk "Apply to all" one) -- forwarded to onCreateLocation so
  // the page knows which one to reopen on return.
  onCreateLocation: (context?: VariantInventoryContext) => void;
  // Rough weight suggestion for one row, from its own size/material — see
  // weight-estimate.ts. Computed by the page (it has category/chart context
  // this component doesn't) and only ever pre-fills an empty WeightSheet.
  estimateWeightForRow: (row: VariantRow) => WeightEstimate;
  // Set together, right after returning from that side-trip -- jumps
  // straight back to the combinations step and the specific Inventory sheet
  // (with its Edit locations picker already open) instead of landing back
  // on the collapsed product form.
  initialInventoryContext?: VariantInventoryContext | null;
  initialNewLocationId?: string | null;
  // Fired once, from this component's own mount effect below -- not from a
  // plain effect at the PAGE level, because this component (gated behind an
  // async storeId resolving) can mount several renders after the page
  // itself does. Clearing the page's copy on the page's own mount would run
  // before this component -- and VariantCombinationsSheet below it, which is
  // the one that actually reads the value -- ever existed to consume it.
  onInventoryContextConsumed?: () => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(() =>
    initialInventoryContext ? "combinations" : null,
  );

  // Runs once, after this component (and VariantCombinationsSheet below it,
  // mounted in the same initial render whenever initialInventoryContext is
  // set) have both already captured the value into their own lazy useState
  // initializers -- effects always fire after the render/commit that set
  // them up, so this can't race ahead of that.
  useEffect(() => {
    if (initialInventoryContext) onInventoryContextConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate rows whenever options/values change. The rules that decide what
  // survives that (and what a brand-new row starts as) live in
  // variant-combinations.ts as a pure function -- they're the highest-stakes
  // logic in this form (getting them wrong silently blanks a seller's prices
  // and stock), and out here they're covered by variant-combinations.test.ts
  // rather than only being verifiable by hand on a phone.
  useEffect(() => {
    setRows((prevRows) => regenerateRows(options, prevRows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="border-b-8 border-gray-50">
      <p className="px-4 pt-4 text-[15px] font-semibold text-gray-900">Variants</p>

      <div className="px-4">
        {options.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditingIndex(0)}
            className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
          >
            <span className="flex items-center gap-3 text-[15px] text-gray-900">
              <Plus size={18} className="text-gray-400" />
              Add options (color, size, material, etc.)
            </span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setWizardStep("list")}
            className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
          >
            <span className="flex flex-col items-start gap-0.5 min-w-0">
              <span className="text-[15px] text-gray-900 truncate">
                {options.map((o) => o.name || "Untitled option").join(" / ")}
              </span>
              <span className="text-xs text-gray-400">
                {selectedCount} of {rows.length} variant{rows.length === 1 ? "" : "s"}
              </span>
            </span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        )}
      </div>

      {wizardStep === "list" && (
        <VariantListSheet
          options={options}
          maxOptions={MAX_OPTIONS}
          onEdit={(i) => setEditingIndex(i)}
          onRemove={removeOption}
          onAddNew={() => setEditingIndex(options.length)}
          onContinue={() => setWizardStep("combinations")}
          onBack={() => setWizardStep(null)}
        />
      )}

      {wizardStep === "combinations" && (
        <VariantCombinationsSheet
          options={options}
          rows={rows}
          setRows={setRows}
          mainImageUrl={mainImageUrl}
          additionalImageUrls={additionalImageUrls}
          storeId={storeId}
          onCreateLocation={onCreateLocation}
          estimateWeightForRow={estimateWeightForRow}
          initialInventoryContext={initialInventoryContext}
          initialNewLocationId={initialNewLocationId}
          onBack={() => setWizardStep("list")}
          onDone={() => setWizardStep(null)}
        />
      )}

      {editingIndex !== null && (
        <OptionEditorSheet
          // The sheet owns the whole option set, not one slot: a seller can
          // define Size *and* Color in one pass, and it returns all of them.
          initialOptions={options}
          initialName={options[editingIndex]?.name ?? ""}
          maxOptions={MAX_OPTIONS}
          onSave={(nextOptions) => {
            setOptions(() => nextOptions);
            setEditingIndex(null);
            // "Next" always lands you on the variation list, whether this
            // was the very first option or an edit made from inside it.
            setWizardStep("list");
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
