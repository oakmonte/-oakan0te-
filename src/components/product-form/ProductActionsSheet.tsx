import { useState } from "react";
import { X, Trash2 } from "lucide-react";

// Two-step bottom sheet: tapping "Delete product" swaps the same sheet into
// an explicit "are you sure" confirm step rather than deleting immediately —
// mirrors the confirm pattern already used for collection deletes.
export function ProductActionsSheet({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this product.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={deleting ? undefined : onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
        {confirming ? (
          <>
            <h2 className="font-semibold text-base mb-1">Delete this product?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This removes it everywhere — its images, variants, and stock can't be recovered.
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 text-center rounded-xl py-3.5 text-sm font-medium border border-gray-200 text-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 text-center rounded-xl py-3.5 text-sm font-semibold bg-red-600 text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Product actions</h2>
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
              <span className="text-[15px] font-medium text-red-600">Delete product</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
