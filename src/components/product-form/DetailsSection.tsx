import { Plus, ChevronRight } from "lucide-react";
import { CategoryNode } from "@/lib/categories";

export function DetailsSection({
  title,
  setTitle,
  descriptionShort,
  onOpenDescription,
  categoryPath,
  onOpenCategoryPicker,
  price,
  compareAtPrice,
  onOpenPriceSheet,
}: {
  title: string;
  setTitle: (v: string) => void;
  descriptionShort: string;
  onOpenDescription: () => void;
  categoryPath: CategoryNode[];
  onOpenCategoryPicker: () => void;
  price: string;
  compareAtPrice: string;
  onOpenPriceSheet: () => void;
}) {
  const categoryLabel = categoryPath.length ? categoryPath[categoryPath.length - 1].name : null;
  const hasDescription = descriptionShort.trim().length > 0;

  return (
    <div className="px-4 py-4 border-b-8 border-gray-50">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Product title"
        autoFocus
        className="w-full text-2xl font-semibold text-gray-900 placeholder:text-gray-600 outline-none pb-3 border-b border-gray-100"
      />

      <button
        type="button"
        onClick={onOpenDescription}
        className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
      >
        <span className="flex items-center gap-3 text-[15px] text-gray-900">
          <Plus size={18} className="text-gray-400" />
          {hasDescription ? "Description" : "Add description"}
        </span>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </button>

      <button
        type="button"
        onClick={onOpenCategoryPicker}
        className="w-full flex items-center justify-between py-4 border-b border-gray-100"
      >
        <span className="flex items-center gap-3 text-[15px] text-gray-900">
          <Plus size={18} className="text-gray-400" />
          {categoryLabel ?? "Select category"}
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>

      <button
        type="button"
        onClick={onOpenPriceSheet}
        className="w-full flex items-center justify-between py-4"
      >
        <span className="text-[15px] text-gray-500">
          {compareAtPrice && (
            <span className="line-through mr-2 text-gray-300">
              ₦{Number(compareAtPrice).toLocaleString()}
            </span>
          )}
          <span className="text-2xl text-gray-900 font-medium">
            ₦{price ? Number(price).toLocaleString() : "0.00"}
          </span>
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
    </div>
  );
}
