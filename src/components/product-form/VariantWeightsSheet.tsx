import { useState } from "react";
import type { WeightEstimate } from "@/lib/weight-estimate";
import { ChevronRight, X } from "lucide-react";
import type { VariantRow } from "./VariantMatrixBuilder";
import { WeightSheet } from "./WeightSheet";

function rowLabel(row: VariantRow): string {
  return row.options.map((o) => o.value).join(" / ");
}

/** Per-variant shipping weight, as reachable from the Necessities checklist.
 *
 *  Weight is the one necessity a variant product can't satisfy from a single
 *  field — it's per row. This used to just close Necessities and drop the
 *  seller back on the product page next to the variant matrix, which reads
 *  as the button being broken (you tap a checklist row and land somewhere
 *  else entirely, with nothing opened). Same rows, same per-row WeightSheet
 *  the matrix itself opens — only the way in is different. */
export function VariantWeightsSheet({
  rows,
  estimateWeightForRow,
  onChangeRows,
  onClose,
}: {
  rows: VariantRow[];
  estimateWeightForRow: (row: VariantRow) => WeightEstimate;
  onChangeRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  onClose: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Unselected combinations are never written as variants, so they have no
  // weight to set -- matches what paramFillState counts for this necessity.
  const selected = rows.filter((r) => r.selected);
  const editingRow = selected.find((r) => r.key === editingKey) ?? null;
  const remaining = selected.filter((r) => r.weightGrams == null).length;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Weight</span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {selected.length === 0 ? (
          <p className="px-4 py-10 text-sm text-gray-400 text-center">
            No variants selected yet — pick your combinations first, then set each one's weight
            here.
          </p>
        ) : (
          <>
            <p className="px-4 pt-5 pb-3 text-sm text-gray-500">
              {remaining === 0
                ? "Every variant has a weight — riders and couriers can quote all of them."
                : `${remaining} of ${selected.length} still need a weight.`}
            </p>
            {selected.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setEditingKey(row.key)}
                className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-50 text-left oak-motion-control"
              >
                <span className="text-[15px] text-gray-900 truncate pr-3">{rowLabel(row)}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[15px] ${
                      row.weightGrams != null ? "text-gray-900" : "text-gray-300"
                    }`}
                  >
                    {row.weightGrams != null ? `${row.weightGrams} g` : "—"}
                  </span>
                  <ChevronRight size={16} className="text-gray-300" />
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {editingRow && (
        <WeightSheet
          productLabel={rowLabel(editingRow)}
          initial={editingRow.weightGrams ?? null}
          estimate={estimateWeightForRow(editingRow)}
          onSave={(grams) => {
            onChangeRows((prev) =>
              prev.map((r) => (r.key === editingRow.key ? { ...r, weightGrams: grams } : r)),
            );
            setEditingKey(null);
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </div>
  );
}
