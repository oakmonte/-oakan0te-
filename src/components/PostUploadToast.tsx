import { useSyncExternalStore } from "react";
import { Loader2, Check, X } from "lucide-react";
import {
  subscribePostUpload,
  getPostUploadSnapshot,
  retryPostUpload,
  dismissPostUpload,
} from "@/lib/post-upload";
import { GLASS_RIM, glassDark } from "@/lib/liquid-glass";

const LABELS = {
  uploading: { published: "Posting…", draft: "Saving to drafts…" },
  success: { published: "Posted", draft: "Saved to drafts" },
  error: { published: "Couldn't post", draft: "Couldn't save draft" },
};

/** Mounted once in __root.tsx so it survives navigating away from the
 *  publish page — the upload it's reporting on keeps running in the
 *  background regardless of what route the seller is on. See post-upload.ts. */
export function PostUploadToast() {
  const state = useSyncExternalStore(subscribePostUpload, getPostUploadSnapshot, () => null);
  if (!state) return null;

  return (
    <div
      className={`oak-motion-fade fixed left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-white max-w-[92vw] ${GLASS_RIM}`}
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        ...glassDark,
        // Denser than the base recipe: a toast has to be read at a glance
        // over whatever is behind it, including white screens.
        background: "rgba(24,26,30,0.78)",
      }}
    >
      {state.status === "uploading" && (
        <>
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>{LABELS.uploading[state.kind]}</span>
        </>
      )}
      {state.status === "success" && (
        <>
          <Check size={15} className="text-green-400 shrink-0" />
          <span>{LABELS.success[state.kind]}</span>
        </>
      )}
      {state.status === "error" && (
        <>
          <span className="truncate">{LABELS.error[state.kind]}</span>
          <button
            type="button"
            onClick={retryPostUpload}
            className="font-semibold underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={dismissPostUpload}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
