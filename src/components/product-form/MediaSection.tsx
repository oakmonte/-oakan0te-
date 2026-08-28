import { useRef, useState } from "react";
import { ImageIcon, Plus, X, Loader2 } from "lucide-react";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import { ImageSourceSheet, type ImageSource } from "./ImageSourceSheet";
import { useMultiFilePicker } from "@/hooks/use-file-picker";
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
  // Multi-image support (add/remove/re-add without losing what's already
  // there) only makes sense where the caller actually tracks a gallery —
  // store.collections_.new.tsx only wants a single cover image, so it never
  // passes onAdditionalChange, and the native picker stays single-select.
  const supportsGallery = !!onAdditionalChange;

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const filePicker = useMultiFilePicker("image/*", supportsGallery);
  const anchorRef = useRef<HTMLDivElement>(null);

  const images = mainImageUrl ? [mainImageUrl, ...additionalImageUrls] : additionalImageUrls;

  function openSourceSheet() {
    setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null);
    setSourceSheetOpen(true);
  }

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

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      const urls = await Promise.all(files.map((f) => uploadProductImage(f)));
      addUrls(urls);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload one or more images");
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
    await uploadFiles(await filePicker.pick());
  }

  function handlePicked(urls: string[]) {
    setDraftsOpen(false);
    addUrls(urls);
  }

  // Removing the cover image promotes the next gallery image to take its
  // place instead of leaving a gap — mirrors how the storefront slideshow
  // editor treats its image array as one ordered list, not a special first
  // slot plus extras.
  function removeImage(url: string) {
    if (url === mainImageUrl) {
      const [nextMain, ...rest] = additionalImageUrls;
      onChange(nextMain ?? "");
      onAdditionalChange?.(rest);
    } else {
      onAdditionalChange?.(additionalImageUrls.filter((u) => u !== url));
    }
  }

  return (
    <div className="px-4 py-5 border-b-8 border-gray-50">
      {filePicker.node}

      <div ref={anchorRef}>
        {images.length === 0 ? (
          <div className="w-full flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={openSourceSheet}
              disabled={uploading}
              aria-label="Add images"
              className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={22} className="text-gray-400 animate-spin" />
              ) : (
                <ImageIcon size={28} className="text-gray-300" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-900">Add images</span>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {images.map((url, i) => (
              <div
                key={url}
                className="relative w-20 h-20 shrink-0 rounded-xl bg-gray-100 overflow-hidden"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X size={11} className="text-white" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={openSourceSheet}
              disabled={uploading}
              aria-label="Add more images"
              className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={18} className="text-gray-400 animate-spin" />
              ) : (
                <Plus size={18} className="text-gray-400" />
              )}
            </button>
          </div>
        )}
      </div>

      {uploadError && <p className="text-xs text-red-500 text-center mt-2">{uploadError}</p>}

      {sourceSheetOpen && (
        <ImageSourceSheet
          anchorRect={anchorRect}
          onSelect={handleSource}
          onClose={() => setSourceSheetOpen(false)}
        />
      )}
      {draftsOpen && (
        <DraftImagePickerSheet onSelect={handlePicked} onClose={() => setDraftsOpen(false)} />
      )}
    </div>
  );
}
