import { useSyncExternalStore } from "react";
import { Loader2, Check, X } from "lucide-react";
import {
  subscribeProductSave,
  getProductSaveSnapshot,
  retryProductSave,
  dismissProductSave,
} from "@/lib/product-save";

/** Mounted once in __root.tsx so it survives navigating away from the
 *  product form — the save it's reporting on keeps running in the
 *  background regardless of what route the seller is on. See product-save.ts. */
export function ProductSaveToast() {
  const state = useSyncExternalStore(subscribeProductSave, getProductSaveSnapshot, () => null);
  if (!state) return null;

  return (
    <div
      className="oak-motion-fade fixed left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-white max-w-[92vw]"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        background: "rgba(24,24,24,0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      {state.status === "saving" && (
        <>
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>Saving product…</span>
        </>
      )}
      {state.status === "success" && (
        <>
          <Check size={15} className="text-green-400 shrink-0" />
          <span>Product saved</span>
        </>
      )}
      {state.status === "error" && (
        <>
          <span className="truncate">Couldn't save: {state.message}</span>
          <button
            type="button"
            onClick={retryProductSave}
            className="font-semibold underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={dismissProductSave}
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
