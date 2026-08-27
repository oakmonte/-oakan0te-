import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";

export function MediaSection({
  mainImageUrl,
  onChange,
  additionalImageUrls = [],
  onAdditionalChange,
}: {
  mainImageUrl: string;
  onChange: (v: string) => void;
  additionalImageUrls?: string[];
  onAdditionalChange?: (urls: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePicked(urls: string[]) {
    setPickerOpen(false);
    if (urls.length === 0) return;
    const [first, ...rest] = urls;
    if (!mainImageUrl.trim()) {
      onChange(first);
      if (rest.length > 0 && onAdditionalChange) {
        onAdditionalChange([...additionalImageUrls, ...rest]);
      }
    } else if (onAdditionalChange) {
      const merged = [...additionalImageUrls, ...urls].filter(
        (u, i, arr) => arr.indexOf(u) === i && u !== mainImageUrl,
      );
      onAdditionalChange(merged);
    }
  }

  function removeAdditional(url: string) {
    onAdditionalChange?.(additionalImageUrls.filter((u) => u !== url));
  }

  return (
    <div className="px-4 py-5 border-b-8 border-gray-50">
      <div className="w-full flex flex-col items-center gap-2">
        <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
          {mainImageUrl ? (
            <img src={mainImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-gray-300" />
          )}
        </div>
        <span className="text-sm font-medium text-gray-900">Add images</span>
      </div>
      <input
        value={mainImageUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste an image URL for now"
        className="mt-3 w-full text-base text-center text-gray-500 outline-none placeholder:text-gray-400"
      />
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-1 w-full text-center text-sm font-medium text-gray-900"
      >
        Choose from drafts
      </button>

      {onAdditionalChange && additionalImageUrls.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {additionalImageUrls.map((url) => (
            <div
              key={url}
              className="relative w-16 h-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAdditional(url)}
                aria-label="Remove image"
                className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <DraftImagePickerSheet onSelect={handlePicked} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
