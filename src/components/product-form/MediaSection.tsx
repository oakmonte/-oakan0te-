import { useRef, useState } from "react";
import { ImageGallery } from "./ImageGallery";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import { PostImagePickerSheet } from "./PostImagePickerSheet";
import type { PickedMedia } from "./MediaPickerSheet";
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
  // Multi-image support (add/remove/reorder without losing what's already
  // there) only makes sense where the caller actually tracks a gallery —
  // store.collections_.new.tsx only wants a single cover image, so it never
  // passes onAdditionalChange, and the native picker stays single-select.
  const supportsGallery = !!onAdditionalChange;

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const filePicker = useMultiFilePicker("image/*", supportsGallery);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const images = mainImageUrl ? [mainImageUrl, ...additionalImageUrls] : additionalImageUrls;

  // The gallery's own array IS the source of truth — first item is always
  // the cover — so add/remove/reorder all funnel through this one setter.
  function applyImages(next: string[]) {
    const [first, ...rest] = next;
    onChange(first ?? "");
    onAdditionalChange?.(rest);
  }

  function openSourceSheet() {
    setAnchorRect(addButtonRef.current?.getBoundingClientRect() ?? null);
    setSourceSheetOpen(true);
  }

  function addUrls(urls: string[]) {
    if (urls.length === 0) return;
    applyImages([...images, ...urls.filter((u) => !images.includes(u))]);
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
    if (source === "posts") {
      setPostsOpen(true);
      return;
    }
    await uploadFiles(await filePicker.pick());
  }

  function handlePicked(media: PickedMedia[]) {
    setDraftsOpen(false);
    addUrls(media.map((m) => m.url));
  }

  function handlePickedFromPosts(media: PickedMedia[]) {
    setPostsOpen(false);
    addUrls(media.map((m) => m.url));
  }

  return (
    <div className="px-4 py-5 border-b-8 border-gray-50">
      {filePicker.node}

      <ImageGallery
        images={images}
        onReorder={applyImages}
        onRemove={(url) => applyImages(images.filter((u) => u !== url))}
        onAddTap={openSourceSheet}
        uploading={uploading}
        addButtonRef={addButtonRef}
      />

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
      {postsOpen && (
        <PostImagePickerSheet
          onSelect={handlePickedFromPosts}
          onClose={() => setPostsOpen(false)}
        />
      )}
    </div>
  );
}
