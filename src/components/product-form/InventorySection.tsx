import { Minus, Plus } from "lucide-react";

export function InventorySection({
  stockQty,
  setStockQty,
}: {
  stockQty: number;
  setStockQty: (fn: (q: number) => number) => void;
}) {
  return (
    <div className="px-4 py-4 border-b-8 border-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] font-semibold text-gray-900">Inventory</span>
        <span className="text-sm text-blue-600 font-medium">Edit</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-gray-900">Available</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStockQty((q) => Math.max(0, q - 1))}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <Minus size={14} />
          </button>
          <span className="w-10 text-center text-[15px] font-medium bg-gray-100 rounded-full py-1">
            {stockQty}
          </span>
          <button
            type="button"
            onClick={() => setStockQty((q) => q + 1)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}