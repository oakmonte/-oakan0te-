import { Plus, ChevronRight } from "lucide-react";
import { CategoryNode } from "@/lib/categories";

type ExpandedSection = "description" | "price" | null;

export function DetailsSection({
  title,
  setTitle,
  descriptionShort,
  setDescriptionShort,
  categoryPath,
  onOpenCategoryPicker,
  price,
  setPrice,
  compareAtPrice,
  setCompareAtPrice,
  costPrice,
  setCostPrice,
  expanded,
  setExpanded,
}: {
  title: string;
  setTitle: (v: string) => void;
  descriptionShort: string;
  setDescriptionShort: (v: string) => void;
  categoryPath: CategoryNode[];
  onOpenCategoryPicker: () => void;
  price: string;
  setPrice: (v: string) => void;
  compareAtPrice: string;
  setCompareAtPrice: (v: string) => void;
  costPrice: string;
  setCostPrice: (v: string) => void;
  expanded: ExpandedSection;
  setExpanded: (s: ExpandedSection) => void;
}) {
  function toggle(section: ExpandedSection) {
    setExpanded(expanded === section ? null : section);
  }

  const categoryLabel = categoryPath.length ? categoryPath[categoryPath.length - 1].name : null;

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
        onClick={() => toggle("description")}
        className="w-full flex items-center justify-between py-4 border-b border-gray-100"
      >
        <span className="flex items-center gap-3 text-[15px] text-gray-900">
          <Plus size={18} className="text-gray-400" />
          {descriptionShort ? "Description" : "Add description"}
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      {expanded === "description" && (
        <textarea
          value={descriptionShort}
          onChange={(e) => setDescriptionShort(e.target.value)}
          placeholder="Short description"
          rows={3}
          autoFocus
          className="w-full text-base outline-none py-3 text-gray-700 placeholder:text-gray-400"
        />
      )}

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
        onClick={() => toggle("price")}
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
      {expanded === "price" && (
        <div className="grid grid-cols-3 gap-3 pb-3">
          <PriceInput label="Price *" value={price} onChange={setPrice} />
          <PriceInput label="Compare-at" value={compareAtPrice} onChange={setCompareAtPrice} />
          <PriceInput label="Cost" value={costPrice} onChange={setCostPrice} />
        </div>
      )}
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base border border-gray-200 rounded-lg px-2 py-2 outline-none"
      />
    </label>
  );
}
