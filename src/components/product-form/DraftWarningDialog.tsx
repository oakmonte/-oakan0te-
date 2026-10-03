import { EyeOff } from "lucide-react";

// Shown on every save of a product whose status is still Draft. New products
// start as drafts, and drafts are left out of the public storefront, so a
// seller who never touched the status toggle would otherwise list something
// and then wonder why it never showed up. Same bottom-sheet confirm pattern
// as NecessitiesWarningDialog.
export function DraftWarningDialog({
  onPublish,
  onKeepDraft,
  onCancel,
}: {
  onPublish: () => void;
  onKeepDraft: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
        <div className="flex items-center gap-2 mb-1">
          <EyeOff size={18} className="text-amber-500 shrink-0" />
          <h2 className="font-semibold text-base text-gray-900">Saving as a draft</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Drafts don't show on your storefront, so shoppers won't see this product until it's
          active.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onPublish}
            className="w-full text-center rounded-xl py-3.5 text-sm font-semibold bg-black text-white"
          >
            Make active and save
          </button>
          <button
            type="button"
            onClick={onKeepDraft}
            className="w-full text-center rounded-xl py-3.5 text-sm font-medium border border-gray-200 text-gray-900"
          >
            Keep as draft
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
