import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Store, X } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { startBackgroundUpload, onBackgroundUploadDone } from "@/lib/background-upload";
import { saveStoreLogoUrl } from "@/lib/store-logo";

/** The store's picture, full screen. The owner can change it from here.
 *
 *  There is one store picture: stores.logo_url. The dashboard, the theme
 *  editor and this viewer all write it, and every place that shows the
 *  store reads it, so a change here shows up everywhere. */
export function StoreLogoViewer({
  storeId,
  url,
  name,
  canEdit,
  onClose,
  onChange,
}: {
  storeId: string;
  url: string | null;
  name: string;
  canEdit: boolean;
  onClose: () => void;
  /** The new picture: a local preview first, then the uploaded URL. */
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  useOverlayHistory(true, onClose);

  function pick(file: File) {
    setNote(null);
    const previous = url;
    // The shared uploader, same as the dashboard: it survives this viewer
    // closing mid-upload and shows its own retry toast on failure.
    const { id, previewUrl } = startBackgroundUpload(file, "store-theme-image", "store picture");
    onChange(previewUrl);
    onBackgroundUploadDone(id, (upload) => {
      // Never persist a blob: preview URL -- only the real uploaded one.
      if (upload.status !== "success" || !upload.url) return;
      const uploaded = upload.url;
      onChange(uploaded);
      saveStoreLogoUrl(storeId, uploaded).catch((err) => {
        console.error("StoreLogoViewer: could not save the store picture", err);
        if (previous) onChange(previous);
        setNote("Couldn’t save your picture. Try again in a moment.");
      });
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex justify-end px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="aspect-square w-full max-w-[420px] overflow-hidden rounded-full bg-white/10">
          {url ? (
            <img src={url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/40">
              <Store size={96} strokeWidth={1.25} />
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}>
          {note && <p className="mb-3 text-center text-[13.5px] text-red-400">{note}</p>}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) pick(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-black transition-transform duration-150 active:scale-[0.98]"
          >
            <Camera size={18} />
            {url ? "Change picture" : "Add a picture"}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
