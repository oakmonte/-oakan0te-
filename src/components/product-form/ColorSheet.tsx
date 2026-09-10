import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { COLOR_PRESETS, colorSwatchStyle, colorFamilyMembers } from "@/lib/color-options";

/** Colour fill-in for the Necessities checklist.
 *
 *  Colour has exactly one home in the schema — the Color option axis on a
 *  variant product (there is no `color` column on products or
 *  product_variants; see necessities.ts). So this writes option VALUES, and
 *  picking more than one genuinely does add a colour axis to the variant
 *  matrix — said plainly in the footer rather than left as a surprise.
 *
 *  Never opens when the seller already built a Color axis in the variant
 *  editor: that's the richer UI of the two, and a second screen writing the
 *  same values would be a way to silently clobber them. NecessitiesSheet
 *  shows an "already set" note instead. */
export function ColorSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: string[];
  onSave: (colors: string[]) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  // Same two-part match as the variant option editor: a plain substring, plus
  // whole-family expansion so "blue" surfaces Cobalt/Denim/Periwinkle, none of
  // which contain the word.
  const family = q ? colorFamilyMembers(q) : null;
  const matches = q
    ? COLOR_PRESETS.filter((c) => c.toLowerCase().includes(q) || family?.has(c))
    : COLOR_PRESETS;
  // Anything picked that the current search would hide (a typed-in custom
  // colour, or a preset filtered out) pins to the top, so searching can never
  // make an existing pick look like it was dropped.
  const pinned = selected.filter((c) => !matches.includes(c));
  const canCreate =
    q.length > 0 && ![...COLOR_PRESETS, ...selected].some((c) => c.trim().toLowerCase() === q);

  function toggle(color: string) {
    setSelected((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
    );
  }

  function createFromQuery() {
    const value = query.trim();
    if (!value) return;
    setSelected((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setQuery("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Color</span>
        <button
          type="button"
          onClick={() => onSave(selected)}
          className="text-sm font-medium text-black"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) {
              e.preventDefault();
              createFromQuery();
            }
          }}
          placeholder="Add or search a colour"
          className="w-full rounded-xl border border-gray-200 px-4 py-4 text-[15px] outline-none focus:border-gray-400"
        />

        <div className="flex flex-col gap-2 mt-4">
          {canCreate && (
            <button
              type="button"
              onClick={createFromQuery}
              className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3.5 text-left oak-motion-control"
            >
              <Plus size={18} className="text-gray-400 shrink-0" />
              <span className="text-[15px] text-gray-900 truncate">Use "{query.trim()}"</span>
            </button>
          )}

          {[...pinned, ...matches].map((color) => {
            const isSelected = selected.includes(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggle(color)}
                aria-label={`${isSelected ? "Deselect" : "Select"} ${color}`}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left oak-motion-control ${
                  isSelected ? "border-black bg-gray-50" : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                  style={{ background: colorSwatchStyle(color) }}
                />
                <span className="text-[15px] text-gray-900 truncate">{color}</span>
                <span
                  className={`ml-auto w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-black border-black" : "border-gray-300"
                  }`}
                >
                  {isSelected && <Check size={13} className="text-white oak-motion-pop" />}
                </span>
              </button>
            );
          })}

          {matches.length === 0 && !canCreate && (
            <p className="py-6 text-sm text-gray-400 text-center">No matches.</p>
          )}
        </div>
      </div>

      {selected.length > 1 && (
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-400">
            {selected.length} colours — this becomes a Color option, so your product gets a variant
            for each one.
          </p>
        </div>
      )}
    </div>
  );
}
