import { Plus, ChevronRight } from "lucide-react";
import { CategoryNode } from "@/lib/categories";

// Strips tags for the row preview — the sheet stores rich HTML, but the
// collapsed row just needs a plain-text snippet.
function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const descriptionPreview = stripHtml(descriptionShort);

  return (
    <div className="px-4 py-4 border-b-8 border-gray-50">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Product title"
        className="w-full text-2xl font-semibold text-gray-900 placeholder:text-gray-600 outline-none pb-3 border-b border-gray-100"
      />

      <button
        type="button"
        onClick={onOpenDescription}
        className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
      >
        <span className="flex flex-col items-start gap-0.5 min-w-0">
          <span className="flex items-center gap-3 text-[15px] text-gray-900">
            <Plus size={18} className="text-gray-400" />
            {descriptionPreview ? "Description" : "Add description"}
          </span>
          {descriptionPreview && (
            <span className="text-xs text-gray-400 ml-7 truncate max-w-full">
              {descriptionPreview}
            </span>
          )}
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
