import { ChevronRight } from "lucide-react";

/** Collapsed "Inventory" row on the regular-product form — tapping it opens
 *  InventorySheet, which owns SKU/barcode/continue-selling-out-of-stock and
 *  the per-location quantity breakdown. This row is just a summary + entry
 *  point, no editing happens here. */
export function InventorySection({
  available,
  locationCount,
  onOpen,
}: {
  available: number;
  locationCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-gray-50 text-left"
    >
      <div>
        <p className="text-[15px] font-semibold text-gray-900">Inventory</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {locationCount > 0
            ? `${available} available · ${locationCount} location${locationCount === 1 ? "" : "s"}`
            : "Set your SKU, barcode, and stock levels"}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  );
}
