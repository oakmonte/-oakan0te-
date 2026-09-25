import { ChevronRight } from "lucide-react";

/** Collapsed "Inventory" row on the regular-product form — tapping it opens
 *  InventorySheet, which owns continue-selling-out-of-stock and the
 *  per-location quantity breakdown. This row is just a summary + entry
 *  point, no editing happens here. */
export function InventorySection({
  available,
  locationCount,
  onOpen,
  noDivider = false,
}: {
  available: number;
  locationCount: number;
  onOpen: () => void;
  /** Drops the section's own 8px bottom divider -- for a caller grouping
   *  this row inside a card of its own, where the card's border already
   *  closes it off. */
  noDivider?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center justify-between px-4 py-4 text-left ${
        noDivider ? "" : "border-b-8 border-gray-50"
      }`}
    >
      <div>
        <p className="text-[15px] font-semibold text-gray-900">Inventory</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {locationCount > 0
            ? `${available} available · ${locationCount} location${locationCount === 1 ? "" : "s"}`
            : "Set your stock levels and locations"}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  );
}
