import { ChevronRight } from "lucide-react";

/** Collapsed "Weight" row on the regular-product form — tapping it opens
 *  WeightSheet. This row is just a summary + entry point, no editing
 *  happens here. */
export function WeightSection({ grams, onOpen }: { grams: number | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-gray-50 text-left"
    >
      <div>
        <p className="text-[15px] font-semibold text-gray-900">Weight</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {grams != null ? `${grams} g` : "Set the item's shipping weight"}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  );
}
