import { useState } from "react";
import { Check, X } from "lucide-react";
import { MATERIAL_PRESETS } from "@/lib/material-options";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

// Material fill-in for a REGULAR (non-variant) product. Variant products
// carry Material as an option axis with real values (checked directly in
// necessities.ts); a regular product has only the one `material` column and,
// until this sheet, no control anywhere that actually wrote to it — the
// Necessities row for it opened nothing. One-tap presets (the same list
// OptionEditorSheet offers for the Material option axis, apparel + art/craft)
// plus free text, same "always offer both" convention as every other picker
// in this form.
export function MaterialSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (material: string) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [value, setValue] = useState(initial);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Material
        </span>
        <button
          type="button"
          onClick={() => onSave(value.trim())}
          disabled={!value.trim()}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Cotton, Ceramic, Marble…"
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-4 py-4 text-[15px] outline-none focus:border-gray-400 mb-5"
        />

        <p className="text-xs text-gray-400 mb-2">Or pick one</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_PRESETS.map((m) => {
            const isSelected = value === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setValue(m)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium oak-motion-control ${
                  isSelected ? "bg-black text-white border-black" : "border-gray-200 text-gray-700"
                }`}
              >
                {isSelected && <Check size={13} />}
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
