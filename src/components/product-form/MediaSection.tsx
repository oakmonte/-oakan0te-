import { useState } from "react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import { ImageSourceSheet, type ImageSource } from "./ImageSourceSheet";
import { useFilePicker } from "@/hooks/use-file-picker";
import { uploadProductImage } from "@/lib/upload-product-image";

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
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const filePicker = useFilePicker("image/*");

  function addUrls(urls: string[]) {
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

  async function uploadFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      addUrls([await uploadProductImage(file)]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload that image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSource(source: ImageSource) {
    setSourceSheetOpen(false);
    if (source === "drafts") {
      setDraftsOpen(true);
      return;
    }
    await uploadFile(await filePicker.pick());
  }

  function handlePicked(urls: string[]) {
    setDraftsOpen(false);
    addUrls(urls);
  }

  function removeAdditional(url: string) {
    onAdditionalChange?.(additionalImageUrls.filter((u) => u !== url));
  }

  return (
    <div className="px-4 py-5 border-b-8 border-gray-50">
      {filePicker.node}

      <div className="w-full flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setSourceSheetOpen(true)}
          disabled={uploading}
          aria-label="Add images"
          className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 size={22} className="text-gray-400 animate-spin" />
          ) : mainImageUrl ? (
            <img src={mainImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-gray-300" />
          )}
        </button>
        <span className="text-sm font-medium text-gray-900">Add images</span>
      </div>

      {uploadError && <p className="text-xs text-red-500 text-center mt-2">{uploadError}</p>}

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

      {sourceSheetOpen && (
        <ImageSourceSheet onSelect={handleSource} onClose={() => setSourceSheetOpen(false)} />
      )}
      {draftsOpen && (
        <DraftImagePickerSheet onSelect={handlePicked} onClose={() => setDraftsOpen(false)} />
      )}
    </div>
  );
}
