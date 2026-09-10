import { useEffect, useState } from "react";
import type { WeightEstimate } from "@/lib/weight-estimate";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import {
  getSizeChartForCategory,
  type ManualSize,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import {
  paramsForCategory,
  paramFillState,
  findOption,
  normalizeOptionName,
  type NecessityParam,
} from "@/lib/necessities";
import { SizeChartSheet } from "@/components/product-form/size-chart/SizeChartSheet";
import { ManualSizeOnlySheet } from "@/components/product-form/size-chart/ManualSizeOnlySheet";
import { WeightSheet } from "@/components/product-form/WeightSheet";
import { VariantWeightsSheet } from "@/components/product-form/VariantWeightsSheet";
import { LinkContentSheet } from "@/components/product-form/LinkContentSheet";
import { MaterialSheet } from "@/components/product-form/MaterialSheet";
import { ColorSheet } from "@/components/product-form/ColorSheet";

export function NecessitiesSheet({
  categoryPath,
  kind,
  options,
  onChangeOptions,
  material,
  onChangeMaterial,
  sizeMeasurements,
  onChangeSizeMeasurements,
  manualSize,
  onChangeManualSize,
  rows,
  onChangeRows,
  estimateWeightForRow,
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
  // Color picked here writes an option axis -- that's the only place colour
  // exists in the schema (no color column on products or product_variants).
  onChangeOptions: (fn: (prev: VariantOption[]) => VariantOption[]) => void;
  material: string;
  // The regular product's own `material` column. A variant product's material
  // goes per-row instead (see saveMaterial below), so this setter is only
  // used on the regular path.
  onChangeMaterial: (m: string) => void;
  sizeMeasurements: SizeMeasurements;
  onChangeSizeMeasurements: (m: SizeMeasurements) => void;
  manualSize: ManualSize | null;
  onChangeManualSize: (m: ManualSize | null) => void;
  // Only the variant matrix's own rows matter for Weight's filled-check on
  // a variant product; a regular product has no rows at all, hence the
  // separate regularWeightGrams/-Estimate pair mirroring manualSize's split.
  rows: VariantRow[];
  onChangeRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  estimateWeightForRow: (row: VariantRow) => WeightEstimate;
  regularWeightGrams: number | null;
  regularWeightEstimate: WeightEstimate;
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
  const [colorSheetOpen, setColorSheetOpen] = useState(false);
  // Shown instead of opening a picker for a param the variant editor already
  // answered -- see ownedByVariantEditor below. Carries a timestamp so tapping
  // the same row twice restarts both the auto-dismiss and the slide-in.
  const [note, setNote] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(t);
  }, [note]);

  // Which sheet Size opens -- the illustrated chart where one is sourced,
  // the free-form fallback everywhere else. Never gates whether Size CAN be
  // filled (see paramFillState above), only which input UI collects it.
  const sizeChart = getSizeChartForCategory(categoryPath);
  const variantSizeValues = findOption(options, "Size")?.values ?? [];

  // Whether the variant editor -- the richer of the two screens (swatches,
  // systems, per-value ordering) -- owns this param's answer, in which case
  // the checklist row reports instead of opening a second editor that could
  // silently clobber it.
  //
  // The threshold differs by param because they write to different places:
  //
  //   Color    ColorSheet writes the axis ITSELF, and writes exactly one
  //            value. So a 0- or 1-value axis is its own output and must stay
  //            editable here -- gating on "any axis at all" meant a seller
  //            who picked a colour from this checklist could never change it
  //            again, and got told to go edit it in variant options they
  //            never opened. Two or more values can only have come from the
  //            variant editor, and that is a real colour axis it owns.
  //   Material MaterialSheet writes per-row `material`, never the axis. So
  //            any Material axis at all is someone else's data, and reopening
  //            over it would leave the axis and the rows disagreeing.
  function ownedByVariantEditor(param: NecessityParam): boolean {
    const count = findOption(options, param)?.values.length ?? 0;
    return param === "Color" ? count > 1 : count > 0;
  }

  const variantColors = findOption(options, "Color")?.values ?? [];

  function saveColors(colors: string[]) {
    onChangeOptions((prev) => {
      const idx = prev.findIndex((o) => normalizeOptionName(o.name) === "color");
      if (colors.length === 0) return idx === -1 ? prev : prev.filter((_, i) => i !== idx);
      if (idx === -1) return [...prev, { name: "Color", values: colors }];
      return prev.map((o, i) => (i === idx ? { ...o, values: colors } : o));
    });
    setColorSheetOpen(false);
  }

  // A regular product has one material column; a variant product has one per
  // row (product_variants.material). Picking here means "this product is made
  // of X", so every selected row gets it -- deliberately NOT a new option
  // axis, which would relabel every variant and multiply the matrix for what
  // is usually a single answer. A seller who genuinely sells the same piece
  // in two fabrics still adds Material as a real axis in the variant editor,
  // and that wins (ownedByVariantEditor sends them there instead of here).
  const rowMaterials = new Set(rows.filter((r) => r.selected).map((r) => r.material?.trim() ?? ""));
  const sharedRowMaterial = rowMaterials.size === 1 ? [...rowMaterials][0] : "";

  function saveMaterial(m: string) {
    if (kind === "regular") onChangeMaterial(m);
    else onChangeRows((prev) => prev.map((r) => (r.selected ? { ...r, material: m } : r)));
    setMaterialSheetOpen(false);
  }

  function showNote(text: string) {
    setNote({ text, at: Date.now() });
  }

  function handleTap(param: NecessityParam) {
    if (
      kind === "variant" &&
      (param === "Color" || param === "Material") &&
      ownedByVariantEditor(param)
    ) {
      showNote(`${param} is already set from your variant options — edit it there to change it.`);
      return;
    }
    // A variant product stores material per row, so with no combinations built
    // yet there is literally nowhere to put the answer -- say so rather than
    // opening a picker whose Save would quietly do nothing.
    if (param === "Material" && kind === "variant" && rows.every((r) => !r.selected)) {
      showNote("Build your variants first — material is saved on each one.");
      return;
    }
    // Exhaustive on purpose: a new NecessityParam that reaches here without a
    // case fails `tsc`, rather than silently rendering a row that does nothing
    // when tapped (which is exactly how Color shipped).
    switch (param) {
      case "Size":
        return setSizeSheetOpen(true);
      case "Weight":
        return setWeightSheetOpen(true);
      case "Link content":
        return setLinkContentOpen(true);
      case "Material":
        return setMaterialSheetOpen(true);
      case "Color":
        return setColorSheetOpen(true);
      default: {
        const unhandled: never = param;
        throw new Error(`Necessity with no tap handler: ${unhandled}`);
      }
    }
  }

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

      {/* Comes down from under the header rather than replacing the row's own
          content, so the checklist never shifts under the seller's thumb. */}
      {note && (
        <div
          key={note.at}
          className="shrink-0 bg-gray-900 text-white text-xs px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {note.text}
        </div>
      )}

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
            // Color and Material can each already be answered as a real
            // variant option axis, in which case this row reports that
            // instead of opening a second editor over the same values.
            const fromVariants =
              kind === "variant" && (p === "Color" || p === "Material") && ownedByVariantEditor(p);
            const subtitle = fromVariants
              ? "Set in your variant options"
              : p === "Weight" && kind === "variant"
                ? "One per variant"
                : null;
            const onTap = () => handleTap(p);
            return (
              <button
                key={p}
                type="button"
                aria-label={p}
                onClick={onTap}
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
                    {subtitle && (
                      <span className="block text-xs text-gray-400 font-normal">{subtitle}</span>
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

      {weightSheetOpen &&
        (kind === "variant" ? (
          <VariantWeightsSheet
            rows={rows}
            estimateWeightForRow={estimateWeightForRow}
            onChangeRows={onChangeRows}
            onClose={() => setWeightSheetOpen(false)}
          />
        ) : (
          <WeightSheet
            initial={regularWeightGrams}
            estimate={regularWeightEstimate}
            onSave={(grams) => {
              onChangeRegularWeightGrams(grams);
              setWeightSheetOpen(false);
            }}
            onClose={() => setWeightSheetOpen(false)}
          />
        ))}

      {linkContentOpen && (
        <LinkContentSheet
          linkedIds={linkedPostIds}
          onChange={onChangeLinkedPostIds}
          onClose={() => setLinkContentOpen(false)}
        />
      )}

      {materialSheetOpen && (
        <MaterialSheet
          initial={kind === "regular" ? material : sharedRowMaterial}
          onSave={saveMaterial}
          onClose={() => setMaterialSheetOpen(false)}
        />
      )}

      {colorSheetOpen && (
        <ColorSheet
          initial={variantColors}
          onSave={saveColors}
          onClose={() => setColorSheetOpen(false)}
        />
      )}
    </div>
  );
}
