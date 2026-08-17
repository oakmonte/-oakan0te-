import { X, Check } from "lucide-react";

export function ProductTypeSwitchSheet({
  current,
  onClose,
  onSelect,
}: {
  current: "regular" | "variant";
  onClose: () => void;
  onSelect: (type: "regular" | "variant") => void;
}) {
  const options = [
    {
      type: "regular" as const,
      title: "Regular product",
      desc: "This is a product without variations.",
    },
    {
      type: "variant" as const,
      title: "Product with variations",
      desc: "This product has different colors, sizes, etc.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Product type</h2>
          <button onClick={onClose} type="button" className="p-1 -mr-1">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            type="button"
            className="w-full flex items-center justify-between border border-gray-100 rounded-xl p-4 mb-3 text-left last:mb-0"
          >
            <span>
              <span className="block text-[15px] font-medium text-gray-900">{opt.title}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{opt.desc}</span>
            </span>
            {current === opt.type && <Check size={18} className="text-black shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}