import { useState } from "react";
import { X, Trash2 } from "lucide-react";

// Mirrors ProductActionsSheet.tsx's two-step "..." menu -> confirm pattern,
// except the confirm step offers two destructive choices instead of one:
// a collection can be deleted on its own (product_collections cascades,
// products untouched) or along with every product currently in it.
export function CollectionActionsSheet({
  productCount,
  onClose,
  onDeleteOnly,
  onDeleteWithProducts,
}: {
  productCount: number;
  onClose: () => void;
  onDeleteOnly: () => Promise<void>;
  onDeleteWithProducts: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleConfirm(action: () => Promise<void>) {
    setDeleting(true);
    setDeleteError("");
    try {
      await action();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this collection.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={deleting ? undefined : onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
        {confirming ? (
          <>
            <h2 className="font-semibold text-base mb-1">Delete this collection?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Choose whether to keep the {productCount} product{productCount === 1 ? "" : "s"} in
              it.
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleConfirm(onDeleteOnly)}
                disabled={deleting}
                className="w-full text-center rounded-xl py-3.5 text-sm font-medium border border-gray-200 text-gray-900 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete collection only"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(onDeleteWithProducts)}
                disabled={deleting}
                className="w-full text-center rounded-xl py-3.5 text-sm font-semibold bg-red-600 text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete collection and its products"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="w-full text-center py-2 text-sm text-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Collection actions</h2>
              <button onClick={onClose} type="button" className="p-1 -mr-1">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full flex items-center gap-3 border border-gray-100 rounded-xl p-4 text-left oak-motion-control"
            >
              <Trash2 size={18} className="text-red-500 shrink-0" />
              <span className="text-[15px] font-medium text-red-600">Delete collection</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
