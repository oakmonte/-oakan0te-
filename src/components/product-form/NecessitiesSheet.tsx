import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import {
  getSizeChartForCategory,
  type ManualSize,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import { SizeChartSheet } from "@/components/product-form/size-chart/SizeChartSheet";
import { WeightSheet } from "@/components/product-form/WeightSheet";

// Which category-specific parameters a category requires before a product in
// it can be published, keyed by category id anywhere in the chosen path —
// not just the leaf, since e.g. "Dresses" and "Shorts" both fall under
// "Clothing" and share the same requirements. Covers every top-level Apparel
// & Accessories branch, plus the Apparel & Accessories root itself as a
// fallback for sellers who stop there without drilling into a branch; Size
// is only included where it's actually standardized (clothing, costumes,
// shoes) — small-accessory branches don't share a size axis. Beauty &
// Personal Care / Art & Crafts have no category-specific tracked fields
// yet — selecting either of those (at any depth) falls through to just the
// universal params below (Link content).
const NECESSITY_PARAMS: Record<string, string[]> = {
  "apparel-accessories": ["Size", "Color", "Material"],
  clothing: ["Size", "Color", "Material"],
  "costumes-accessories": ["Size", "Color", "Material"],
  shoes: ["Size", "Color", "Material"],
  "clothing-accessories": ["Color", "Material"],
  "shoe-accessories": ["Color", "Material"],
  "handbags-wallets-cases": ["Color", "Material"],
  "handbag-wallet-accessories": ["Material", "Color"],
  jewelry: ["Material", "Color"],
};

// Applies to every category, regardless of what else it tracks: "Link
// content" because a product isn't ready to publish without one, "Weight"
// because shipping needs it for literally any physical product, not just
// categories with a Size/Material axis (a lipstick or a craft item still
// ships in a box).
const UNIVERSAL_PARAMS = ["Weight", "Link content"];

function paramsForCategory(categoryPath: CategoryNode[]): string[] {
  if (categoryPath.length === 0) return [];
  // Walk leaf-to-root so a specific branch (e.g. Jewelry) wins over the
  // broader Apparel & Accessories root fallback further up the same path.
  for (let i = categoryPath.length - 1; i >= 0; i--) {
    const params = NECESSITY_PARAMS[categoryPath[i].id];
    if (params) return [...params, ...UNIVERSAL_PARAMS];
  }
  return UNIVERSAL_PARAMS;
}

// Read-only by design — a seller can't check these off by hand, only by
// actually filling in the underlying field. Variant products carry Size/
// Color/Material as option names; regular products only have a dedicated
// field for Material today, so Size/Color always read unfilled there until
// this product type grows fields for them. "Link content" has no tracked
// field anywhere yet, so it always reads unfilled until that feature exists.
//
// "Size" is special-cased further: for categories with a size chart defined
// (see size-chart-config.ts), Size is driven by the chart instead of the
// plain option-existence check, for BOTH product kinds — a regular product
// has no options at all, so without this it could never satisfy Size.
//   - Variant Size axis exists (options has a "Size" entry): filled once
//     every one of those values has at least one measurement recorded —
//     matches the swipe-through-every-size flow in SizeChartSheet.
//   - No Variant Size axis (regular product, or variant product that only
//     varies by e.g. Color/Material): filled once a manual size has been
//     picked, regardless of whether any measurement was added — the pick
//     itself is the useful bit for a seller who doesn't need a size chart.
// Everywhere a chart isn't defined yet, Size keeps the old check, unchanged.
function isFilled(
  param: string,
  kind: "regular" | "variant",
  options: VariantOption[],
  material: string,
  hasChart: boolean,
  variantSizeValues: string[],
  sizeMeasurements: SizeMeasurements,
  manualSize: ManualSize | null,
  rows: VariantRow[],
  regularWeightGrams: number | null,
): boolean {
  if (param === "Link content") return false;
  if (param === "Size" && hasChart) {
    if (variantSizeValues.length > 0) {
      return variantSizeValues.every((sv) => Object.keys(sizeMeasurements[sv] ?? {}).length > 0);
    }
    return manualSize !== null;
  }
  // Weight isn't a variant option axis the way Color/Size/Material are —
  // nobody picks "142g" as a buyer-facing choice — so it doesn't go through
  // the options.some(...) check below even for a variant product. Filled
  // once every selected row has its own weight set; a regular product has
  // exactly the one implicit "row".
  if (param === "Weight") {
    if (kind === "variant") {
      return rows.filter((r) => r.selected).every((r) => r.weightGrams != null);
    }
    return regularWeightGrams != null;
  }
  if (kind === "variant") {
    return options.some(
      (o) => o.name.trim().toLowerCase() === param.toLowerCase() && o.values.length > 0,
    );
  }
  return param === "Material" && material.trim().length > 0;
}

export function NecessitiesSheet({
  categoryPath,
  kind,
  options,
  material,
  sizeMeasurements,
  onChangeSizeMeasurements,
  manualSize,
  onChangeManualSize,
  rows,
  regularWeightGrams,
  regularWeightEstimate,
  onChangeRegularWeightGrams,
  onClose,
}: {
  categoryPath: CategoryNode[];
  kind: "regular" | "variant";
  options: VariantOption[];
  material: string;
  sizeMeasurements: SizeMeasurements;
  onChangeSizeMeasurements: (m: SizeMeasurements) => void;
  manualSize: ManualSize | null;
  onChangeManualSize: (m: ManualSize | null) => void;
  // Only the variant matrix's own rows matter for Weight's filled-check on
  // a variant product; a regular product has no rows at all, hence the
  // separate regularWeightGrams/-Estimate pair mirroring manualSize's split.
  rows: VariantRow[];
  regularWeightGrams: number | null;
  regularWeightEstimate: number | null;
  onChangeRegularWeightGrams: (g: number | null) => void;
  onClose: () => void;
}) {
  const params = paramsForCategory(categoryPath);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  // Chart applies regardless of kind now — a regular product is exactly the
  // case that has no Variant Size axis to fall back on, so it needs this
  // just as much as a variant product with only Color/Material options.
  const sizeChart = getSizeChartForCategory(categoryPath);
  const variantSizeValues =
    options.find((o) => o.name.trim().toLowerCase() === "size")?.values ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Necessities
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {params.length === 0 ? (
          <p className="px-4 py-10 text-sm text-gray-400 text-center">
            {categoryPath.length === 0
              ? "Select a category to see what's required."
              : "No required details for this category yet."}
          </p>
        ) : (
          params.map((p) => {
            const filled = isFilled(
              p,
              kind,
              options,
              material,
              !!sizeChart,
              variantSizeValues,
              sizeMeasurements,
              manualSize,
              rows,
              regularWeightGrams,
            );
            const opensSizeChart = p === "Size" && !!sizeChart;
            // Weight only opens a real editor for a regular product -- it
            // has exactly one value. A variant product's weight lives per
            // row in the variant matrix (its own Weight button there), so
            // this stays a status-only checkmark for now, same as Color/
            // Material below until those get their own fill-in sheets too.
            const opensWeightSheet = p === "Weight" && kind === "regular";
            return (
              <button
                key={p}
                type="button"
                aria-label={p}
                onClick={
                  opensSizeChart
                    ? () => setSizeChartOpen(true)
                    : opensWeightSheet
                      ? () => setWeightSheetOpen(true)
                      : // TODO: open the per-parameter fill-in sheet once its design is specced, for everything but Size/Weight
                        () => {}
                }
                className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-50 text-left oak-motion-control"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      filled ? "bg-black border-black" : "border-gray-300"
                    }`}
                  >
                    {filled && <Check size={13} className="text-white oak-motion-pop" />}
                  </span>
                  <span className="text-[15px] text-gray-900">{p}</span>
                </span>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {sizeChartOpen && sizeChart && (
        <SizeChartSheet
          variantSizeValues={variantSizeValues}
          manualSize={manualSize}
          chart={sizeChart}
          initialMeasurements={sizeMeasurements}
          onSave={(m, picked) => {
            onChangeSizeMeasurements(m);
            onChangeManualSize(picked);
            setSizeChartOpen(false);
          }}
          onClose={() => setSizeChartOpen(false)}
        />
      )}

      {weightSheetOpen && (
        <WeightSheet
          initial={regularWeightGrams}
          estimate={regularWeightEstimate}
          onSave={(grams) => {
            onChangeRegularWeightGrams(grams);
            setWeightSheetOpen(false);
          }}
          onClose={() => setWeightSheetOpen(false)}
        />
      )}
    </div>
  );
}
