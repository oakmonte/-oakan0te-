import { TriangleAlert } from "lucide-react";

// A soft warning, not a hard stop -- Save used to refuse outright when a
// necessity (Size, Material, Weight, Link content, or the category itself)
// wasn't filled in. That's gone: a seller can always save, published or as
// a draft, missing details and all. This just makes sure they know before
// they do, with one tap to go fix it and one to proceed anyway. Same
// bottom-sheet confirm pattern as CollectionActionsSheet's delete step.
export function NecessitiesWarningDialog({
  reviewLabel,
  onReview,
  onSaveAnyway,
  onCancel,
}: {
  /** "Pick a category" when that's what's missing, "Review necessities"
   *  otherwise -- whichever is the more useful next step. */
  reviewLabel: string;
  onReview: () => void;
  onSaveAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
        <div className="flex items-center gap-2 mb-1">
          <TriangleAlert size={18} className="text-amber-500 shrink-0" />
          <h2 className="font-semibold text-base text-gray-900">Some details are missing</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          This listing is missing necessities buyers or Oakmonte's logistics may need — you can
          still save it as-is and fill these in later.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onReview}
            className="w-full text-center rounded-xl py-3.5 text-sm font-medium border border-gray-200 text-gray-900"
          >
            {reviewLabel}
          </button>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="w-full text-center rounded-xl py-3.5 text-sm font-semibold bg-black text-white"
          >
            Save anyway
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center py-2 text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
