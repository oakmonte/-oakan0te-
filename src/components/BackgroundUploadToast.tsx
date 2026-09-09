import { useSyncExternalStore } from "react";
import { Loader2, Check, X } from "lucide-react";
import {
  subscribeBackgroundUploads,
  getBackgroundUploadsSnapshot,
  retryBackgroundUpload,
  dismissBackgroundUpload,
  type BackgroundUpload,
} from "@/lib/background-upload";

// Module-level, not inline in the component: useSyncExternalStore requires
// its server-snapshot getter to return a STABLE reference across calls, same
// as the client one -- a fresh `[]` literal on every call (what this used to
// be) fails that check and React logs "getServerSnapshot should be cached"
// on every render, on every route, since this toast is mounted globally.
const EMPTY_UPLOADS: BackgroundUpload[] = [];

/** Mounted once in __root.tsx so it survives closing whichever popover
 *  started an upload (or navigating away entirely) -- the upload keeps
 *  running in the background regardless. Unlike PostUploadToast/
 *  ProductSaveToast, several uploads can be in flight at once, so this
 *  renders a stack rather than a single row: in-flight ones collapse into
 *  one summary pill (nobody needs a running list of "photo 1 of 3
 *  uploading"), but each error gets its own row with its own Retry, since
 *  they can fail independently and need independent action. See
 *  background-upload.ts. */
export function BackgroundUploadToast() {
  const uploads = useSyncExternalStore(
    subscribeBackgroundUploads,
    getBackgroundUploadsSnapshot,
    () => EMPTY_UPLOADS,
  );
  if (uploads.length === 0) return null;

  const uploading = uploads.filter((u) => u.status === "uploading");
  const errors = uploads.filter((u) => u.status === "error");
  const succeeded = uploads.filter((u) => u.status === "success");

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-1.5 max-w-[92vw]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      {uploading.length > 0 && (
        <Pill>
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>
            Uploading {uploading.length} photo{uploading.length === 1 ? "" : "s"}…
          </span>
        </Pill>
      )}
      {succeeded.map((u) => (
        <Pill key={u.id}>
          <Check size={15} className="text-green-400 shrink-0" />
          <span className="truncate">{u.label} uploaded</span>
        </Pill>
      ))}
      {errors.map((u) => (
        <Pill key={u.id}>
          <span className="truncate">Couldn't upload {u.label}</span>
          <button
            type="button"
            onClick={() => retryBackgroundUpload(u.id)}
            className="font-semibold underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => dismissBackgroundUpload(u.id)}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X size={14} />
          </button>
        </Pill>
      ))}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="oak-motion-fade flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-white max-w-full"
      style={{
        background: "rgba(24,24,24,0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </div>
  );
}
