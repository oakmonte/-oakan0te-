import { useEffect, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { OptionEditorSheet } from "./OptionEditorSheet";
import { VariantListSheet } from "./VariantListSheet";
import { VariantCombinationsSheet } from "./VariantCombinationsSheet";
import { cartesian, buildKey } from "./variant-combinations";

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
  // Columns this form has no UI for yet (importers write them — see
  // canonical-product-schema — this form doesn't). Optional and untouched by
  // anything here; the edit page round-trips them so opening an imported
  // product in the editor and hitting Save doesn't silently drop them.
  barcode?: string | null;
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
  onCreateLocation: () => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(null);

  // Regenerate rows whenever options/values change, preserving existing row data by key.
  useEffect(() => {
    const combos = cartesian(options);
    setRows((prevRows) => {
      const prevByKey = new Map(prevRows.map((r) => [r.key, r]));
      return combos.map((combo) => {
        const key = buildKey(combo);
        const existing = prevByKey.get(key);
        // Keep the seller's edits (and their checkbox) across regeneration,
        // but always refresh the option labels in case a name was renamed.
        return existing
          ? { ...existing, options: combo }
          : {
              key,
              options: combo,
              selected: true,
              price: "",
              compareAtPrice: "",
              costPrice: "",
              sku: "",
              mainImageUrl: "",
              continueSellingOutOfStock: false,
              locationQuantities: {},
            };
      });
    });
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
