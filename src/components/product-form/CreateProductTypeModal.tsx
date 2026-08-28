import { X, Package, Boxes, ChevronRight } from "lucide-react";

export function CreateProductTypeModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (type: "regular" | "variant") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full bg-white rounded-t-[28px] p-5 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-base">Create new product</h2>
          <button onClick={onClose} type="button" className="p-1 -mr-1">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Select product type to continue</p>

        <button
          onClick={() => onSelect("regular")}
          type="button"
          className="w-full flex items-center gap-3 border border-gray-300 rounded-xl p-4 mb-3 text-left oak-motion-control active:scale-[0.99]"
        >
          <span className="p-2 rounded-lg bg-gray-100 text-gray-700 shrink-0">
            <Package size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-gray-900">Regular product</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              This is a product without variations.
            </span>
          </span>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </button>

        <button
          onClick={() => onSelect("variant")}
          type="button"
          className="w-full flex items-center gap-3 border border-gray-300 rounded-xl p-4 text-left oak-motion-control active:scale-[0.99]"
        >
          <span className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Boxes size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-gray-900">
              Product with variations
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              This product has different colors, sizes, etc.
            </span>
          </span>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </button>
      </div>
    </div>
  );
}
