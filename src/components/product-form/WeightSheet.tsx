import { useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

/** Per-SKU shipping weight editor -- same split as InventorySheet (a
 *  "regular" product's single implicit variant vs. each row in the variant
 *  matrix). Purely a local-state editor: the page-level Save persists it,
 *  same as every other field in this form.
 *
 *  `estimate` is a rough auto-guess from size measurements + material (see
 *  weight-estimate.ts), computed by the caller since it needs category/chart
 *  context this sheet doesn't have. It only ever pre-fills an empty field —
 *  never overwrites a weight the seller already typed in. */
export function WeightSheet({
  productLabel,
  initial,
  estimate,
  onSave,
  onClose,
}: {
  productLabel?: string;
  initial: number | null;
  estimate: number | null;
  onSave: (grams: number | null) => void;
  onClose: () => void;
}) {
  useLockedViewport();
  const [value, setValue] = useState(
    initial != null ? String(initial) : estimate != null ? String(estimate) : "",
  );
  const isEstimate = initial == null && estimate != null && value === String(estimate);

  function handleSave() {
    const trimmed = value.trim();
    onSave(trimmed ? Math.max(0, Number(trimmed)) : null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3 flex flex-col items-center shrink-0 relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute left-4 top-4 p-1.5 rounded-full bg-gray-100"
        >
          <X size={16} className="text-gray-600" />
        </button>
        <span className="font-semibold text-[16px] text-gray-900">Weight</span>
        {productLabel && <span className="text-xs text-gray-400 mt-0.5">{productLabel}</span>}
      </div>

      <div className="flex-1 px-4 py-5">
        <p className="text-xs text-gray-400 mb-3">
          How much this item weighs on its own, for shipping — not the box or packaging.
        </p>
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-4 focus-within:border-gray-400">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="flex-1 text-2xl font-semibold text-gray-900 outline-none min-w-0"
          />
          <span className="text-sm text-gray-400">g</span>
        </div>
        {isEstimate && (
          <p className="text-xs text-gray-400 mt-2">
            Estimated from this size's measurements and material — edit if it's off.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5"
        >
          Save
        </button>
      </div>
    </div>
  );
}
