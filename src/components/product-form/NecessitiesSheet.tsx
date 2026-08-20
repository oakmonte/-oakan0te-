import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { CategoryNode } from "@/lib/categories";
import { VariantOption } from "@/components/product-form/VariantMatrixBuilder";
import { getSizeChartForCategory, type SizeMeasurements } from "@/lib/size-chart-config";
import { SizeChartSheet } from "@/components/product-form/size-chart/SizeChartSheet";

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

// "Link content" applies to every category — a product isn't ready to
// publish until it has a piece of content (video/post) linked to it,
// regardless of what other attributes that category tracks.
const UNIVERSAL_PARAMS = ["Link content"];

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
// (see size-chart-config.ts), having the option isn't enough — at least one
// measurement has to actually be filled in. Everywhere a chart isn't defined
// yet, Size keeps the plain option-existence check, unchanged.
function isFilled(
  param: string,
  kind: "regular" | "variant",
  options: VariantOption[],
  material: string,
  hasChart: boolean,
  sizeMeasurements: SizeMeasurements,
): boolean {
  if (param === "Link content") return false;
  if (param === "Size" && kind === "variant" && hasChart) {
    return Object.values(sizeMeasurements).some((m) => Object.keys(m).length > 0);
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
  onClose,
}: {
  categoryPath: CategoryNode[];
  kind: "regular" | "variant";
  options: VariantOption[];
  material: string;
  sizeMeasurements: SizeMeasurements;
  onChangeSizeMeasurements: (m: SizeMeasurements) => void;
  onClose: () => void;
}) {
  const params = paramsForCategory(categoryPath);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const sizeChart = kind === "variant" ? getSizeChartForCategory(categoryPath) : null;
  const sizeValues = options.find((o) => o.name.trim().toLowerCase() === "size")?.values ?? [];

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
            const filled = isFilled(p, kind, options, material, !!sizeChart, sizeMeasurements);
            const opensSizeChart = p === "Size" && !!sizeChart;
            return (
              <button
                key={p}
                type="button"
                aria-label={p}
                onClick={opensSizeChart ? () => setSizeChartOpen(true) : () => {}} // TODO: open the per-parameter fill-in sheet once its design is specced, for everything but Size
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
          sizeValues={sizeValues}
          chart={sizeChart}
          initialMeasurements={sizeMeasurements}
          onSave={(m) => {
            onChangeSizeMeasurements(m);
            setSizeChartOpen(false);
          }}
          onClose={() => setSizeChartOpen(false)}
        />
      )}
    </div>
  );
}
