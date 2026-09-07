import { useState } from "react";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import {
  getSizeChartForCategory,
  type ManualSize,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import { paramsForCategory, paramFillState, findOption } from "@/lib/necessities";
import { SizeChartSheet } from "@/components/product-form/size-chart/SizeChartSheet";
import { ManualSizeOnlySheet } from "@/components/product-form/size-chart/ManualSizeOnlySheet";
import { WeightSheet } from "@/components/product-form/WeightSheet";
import { LinkContentSheet } from "@/components/product-form/LinkContentSheet";
import { MaterialSheet } from "@/components/product-form/MaterialSheet";

export function NecessitiesSheet({
  categoryPath,
  kind,
  options,
  material,
  onChangeMaterial,
  sizeMeasurements,
  onChangeSizeMeasurements,
  manualSize,
  onChangeManualSize,
  rows,
  regularWeightGrams,
  regularWeightEstimate,
  onChangeRegularWeightGrams,
  linkedPostIds,
  onChangeLinkedPostIds,
  onClose,
}: {
  categoryPath: CategoryNode[];
  kind: "regular" | "variant";
  options: VariantOption[];
  material: string;
  // Only meaningful for a regular product -- a variant product's Material
  // lives as an option axis (checked directly against `options`), same as
  // Color/Size, and MaterialSheet never opens for it.
  onChangeMaterial: (m: string) => void;
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
  linkedPostIds: string[];
  onChangeLinkedPostIds: (ids: string[]) => void;
  onClose: () => void;
}) {
  const params = paramsForCategory(categoryPath, kind);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [linkContentOpen, setLinkContentOpen] = useState(false);
  const [materialSheetOpen, setMaterialSheetOpen] = useState(false);
  // Which sheet Size opens -- the illustrated chart where one is sourced,
  // the free-form fallback everywhere else. Never gates whether Size CAN be
  // filled (see paramFillState above), only which input UI collects it.
  const sizeChart = getSizeChartForCategory(categoryPath);
  const variantSizeValues = findOption(options, "Size")?.values ?? [];

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
            const state = paramFillState(
              p,
              kind,
              options,
              material,
              variantSizeValues,
              sizeMeasurements,
              manualSize,
              rows,
              regularWeightGrams,
              linkedPostIds,
            );
            const opensSizeSheet = p === "Size";
            // Weight only opens a real editor for a regular product -- it
            // has exactly one value. A variant product's weight lives per
            // row in the variant matrix (its own Weight button there), so
            // tapping it here just closes this sheet and drops the seller
            // back on the page where that control actually is, rather than
            // doing nothing (there's no per-row weight editor to embed here
            // without duplicating the matrix's own UI).
            const opensWeightSheet = p === "Weight" && kind === "regular";
            const closesToVariantWeight = p === "Weight" && kind === "variant";
            const opensLinkContent = p === "Link content";
            // Material only opens a fill-in sheet for a regular product --
            // a variant product's Material lives as an option axis, edited
            // in the variant options UI, same as Color/Size.
            const opensMaterialSheet = p === "Material" && kind === "regular";
            return (
              <button
                key={p}
                type="button"
                aria-label={p}
                onClick={
                  opensSizeSheet
                    ? () => setSizeSheetOpen(true)
                    : opensWeightSheet
                      ? () => setWeightSheetOpen(true)
                      : closesToVariantWeight
                        ? onClose
                        : opensLinkContent
                          ? () => setLinkContentOpen(true)
                          : opensMaterialSheet
                            ? () => setMaterialSheetOpen(true)
                            : // TODO: open the per-parameter fill-in sheet once its design is specced, for Color
                              () => {}
                }
                className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-50 text-left oak-motion-control"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      state === "filled" ? "bg-black border-black" : "border-gray-300"
                    }`}
                  >
                    {state === "filled" && (
                      <Check size={13} className="text-white oak-motion-pop" />
                    )}
                    {state === "partial" && (
                      <Loader2 size={12} className="text-gray-400 animate-spin" />
                    )}
                  </span>
                  <span className="text-[15px] text-gray-900">
                    {p}
                    {closesToVariantWeight && (
                      <span className="block text-xs text-gray-400 font-normal">
                        Set per variant below
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {sizeSheetOpen &&
        (sizeChart ? (
          <SizeChartSheet
            variantSizeValues={variantSizeValues}
            manualSize={manualSize}
            chart={sizeChart}
            initialMeasurements={sizeMeasurements}
            onSave={(m, picked) => {
              onChangeSizeMeasurements(m);
              onChangeManualSize(picked);
              setSizeSheetOpen(false);
            }}
            onClose={() => setSizeSheetOpen(false)}
          />
        ) : (
          <ManualSizeOnlySheet
            variantSizeValues={variantSizeValues}
            manualSize={manualSize}
            initialMeasurements={sizeMeasurements}
            onSave={(m, picked) => {
              onChangeSizeMeasurements(m);
              onChangeManualSize(picked);
              setSizeSheetOpen(false);
            }}
            onClose={() => setSizeSheetOpen(false)}
          />
        ))}

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

      {linkContentOpen && (
        <LinkContentSheet
          linkedIds={linkedPostIds}
          onChange={onChangeLinkedPostIds}
          onClose={() => setLinkContentOpen(false)}
        />
      )}

      {materialSheetOpen && (
        <MaterialSheet
          initial={material}
          onSave={(m) => {
            onChangeMaterial(m);
            setMaterialSheetOpen(false);
          }}
          onClose={() => setMaterialSheetOpen(false)}
        />
      )}
    </div>
  );
}
