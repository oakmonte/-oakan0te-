import { useState } from "react";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import type { VariantOption } from "./VariantMatrixBuilder";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function VariantListSheet({
  options,
  maxOptions = 8,
  onEdit,
  onRemove,
  onAddNew,
  onContinue,
  onBack,
}: {
  options: VariantOption[];
  maxOptions?: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAddNew: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const canContinue = options.length > 0 && options.every((o) => o.values.length > 0);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const removeTarget = removeIndex !== null ? options[removeIndex] : null;

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col min-h-dvh">
      <div className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-1 text-sm text-gray-500 -ml-1"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Add Variation
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="flex flex-col gap-3">
          {options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 truncate">
                  {opt.name || "Untitled option"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{opt.values.join(", ")}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  aria-label={`Edit ${opt.name}`}
                  className="p-2 text-gray-400"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveIndex(i)}
                  aria-label={`Remove ${opt.name}`}
                  className="p-2 text-gray-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {options.length < maxOptions && (
            <button
              type="button"
              onClick={onAddNew}
              className="flex items-center gap-2 py-2 text-sm font-medium text-gray-900"
            >
              <span className="flex-1 h-px bg-gray-200" />
              <span className="flex items-center gap-1.5 shrink-0">
                <Plus size={16} />
                Add new variation
              </span>
              <span className="flex-1 h-px bg-gray-200" />
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 pt-3 oak-safe-bottom">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full bg-black text-white text-sm font-medium rounded-xl py-3.5 disabled:bg-gray-200 disabled:text-gray-400"
        >
          Continue
        </button>
      </div>

      <AlertDialog
        open={removeIndex !== null}
        onOpenChange={(open) => !open && setRemoveIndex(null)}
      >
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{removeTarget?.name || "this variation"}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the option and every value under it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeIndex !== null) onRemove(removeIndex);
                setRemoveIndex(null);
              }}
              className="bg-black rounded-full"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
