import { useEffect, useRef, useState } from "react";
import { ImageGallery } from "./ImageGallery";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import { PostImagePickerSheet } from "./PostImagePickerSheet";
import type { PickedMedia } from "./MediaPickerSheet";
import { ImageSourceSheet, type ImageSource } from "./ImageSourceSheet";
import { useMultiFilePicker } from "@/hooks/use-file-picker";
import { startBackgroundUpload, onBackgroundUploadDone } from "@/lib/background-upload";

export function MediaSection({
  mainImageUrl,
  onChange,
  additionalImageUrls = [],
  onAdditionalChange,
  noDivider = false,
}: {
  mainImageUrl: string;
  onChange: (v: string) => void;
  additionalImageUrls?: string[];
  onAdditionalChange?: (urls: string[]) => void;
  /** Drops the section's own 8px bottom divider -- for a caller grouping
   *  this section inside a card, where the card's border already closes it
   *  off. */
  noDivider?: boolean;
}) {
  // Multi-image support (add/remove/reorder without losing what's already
  // there) only makes sense where the caller actually tracks a gallery — a
  // caller that never passes onAdditionalChange keeps the native picker
  // single-select and only ever has a cover image.
  const supportsGallery = !!onAdditionalChange;

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const filePicker = useMultiFilePicker("image/*", supportsGallery);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const images = mainImageUrl ? [mainImageUrl, ...additionalImageUrls] : additionalImageUrls;
  // Read inside the background-upload success callback instead of closing
  // over `images` directly -- that callback can fire well after this render,
  // by which point the seller may have added/removed other photos, and a
  // stale snapshot would silently revert those when the upload's URL swaps in.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  });

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

  // Uploads run in the background (background-upload.ts) and survive this
  // component unmounting -- closing this sheet, or navigating away, no
  // longer orphans the file on Bunny with no URL ever attached to anything.
  // Each file's object-URL preview goes into the gallery immediately, and
  // gets swapped for the real URL (or left as-is, with the shared toast
  // offering Retry, on failure) whenever that specific upload settles.
  function uploadFiles(files: File[]) {
    // Started for every file BEFORE calling addUrls -- calling addUrls once
    // per file in this loop (the first version of this fix) computed each
    // call from the same stale `images` closure, so a 3-photo pick silently
    // kept only the last one: each call overwrote the previous call's
    // pending update rather than building on it. One batched addUrls call
    // adds every preview from this pick at once.
    const started = files.map((file) => ({
      file,
      ...startBackgroundUpload(file, "product-image", "product photo"),
    }));
    addUrls(started.map((s) => s.previewUrl));
    for (const { id, previewUrl } of started) {
      onBackgroundUploadDone(id, (u) => {
        if (u.status !== "success" || !u.url) return;
        const url = u.url;
        applyImages(imagesRef.current.map((img) => (img === previewUrl ? url : img)));
      });
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
    uploadFiles(await filePicker.pick());
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
    <div className={`px-4 py-5 ${noDivider ? "" : "border-b-8 border-gray-50"}`}>
      {filePicker.node}

      <ImageGallery
        images={images}
        onReorder={applyImages}
        onRemove={(url) => applyImages(images.filter((u) => u !== url))}
        onAddTap={openSourceSheet}
        addButtonRef={addButtonRef}
      />

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
