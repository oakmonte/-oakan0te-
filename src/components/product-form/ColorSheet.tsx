import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { COLOR_PRESETS, colorSwatchStyle, colorFamilyMembers } from "@/lib/color-options";
import { fuzzyScore } from "@/lib/fuzzy-search";
import { ValueRow } from "./value-picker";

/** Colour fill-in for the Necessities checklist.
 *
 *  Colour has exactly one home in the schema -- the Color option axis on a
 *  variant product (there is no `color` column on products or
 *  product_variants; see necessities.ts). So this writes option VALUES.
 *
 *  **Exactly one colour.** Reaching this sheet at all means the seller did not
 *  build a colour axis in the variant editor, and the assumption that follows
 *  is that every variant is the same colour -- this answers "what colour is
 *  it", not "which colours do you sell". Letting it pick several quietly
 *  turned a size-only product into a size x colour matrix from a checklist
 *  row, which is a far bigger decision than that row looks like. A seller who
 *  really does sell several colours adds the axis in the variant editor, the
 *  screen that shows what it costs.
 *
 *  A one-value axis is this sheet's own output, so it stays reopenable and
 *  editable here (see ownedByVariantEditor in NecessitiesSheet). Two or more
 *  values means a real variant axis the richer editor owns, and then the
 *  checklist row reports instead of opening. */
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

  const [value, setValue] = useState(initial[0] ?? "");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  // Three-part match, same as the variant option editor: plain substring,
  // whole-family expansion so "blue" surfaces Cobalt/Denim/Periwinkle (none
  // of which contain the word), then a typo-tolerant pass.
  const family = q ? colorFamilyMembers(q) : null;
  const matches = q
    ? COLOR_PRESETS.filter(
        (c) => c.toLowerCase().includes(q) || family?.has(c) || fuzzyScore(q, c) !== null,
      )
    : COLOR_PRESETS;
  // A pick the current search would hide (a typed-in custom colour, or a
  // preset filtered out) pins to the top, so searching can never make the
  // seller's own answer look like it was dropped.
  const pinned = value && !matches.includes(value) ? [value] : [];
  const canCreate =
    q.length > 0 && ![...COLOR_PRESETS, value].some((c) => c.trim().toLowerCase() === q);

  // Tapping the chosen row again clears it -- the only way to undo a colour
  // without leaving a one-value axis behind on a product that never had one.
  function pick(color: string) {
    setValue((prev) => (prev === color ? "" : color));
    setQuery("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Color</span>
        <button
          type="button"
          onClick={() => onSave(value ? [value] : [])}
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
              pick(query.trim());
            }
          }}
          placeholder="Add or search a colour"
          className="w-full rounded-xl border border-gray-200 px-4 py-4 text-base outline-none focus:border-gray-400"
        />

        <p className="text-xs text-gray-400 mt-2">
          One colour for the whole product. Selling it in several? Add Color as a variant option
          instead.
        </p>

        <div className="flex flex-col gap-2 mt-4">
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(query.trim())}
              className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3.5 text-left oak-motion-control"
            >
              <Plus size={18} className="text-gray-400 shrink-0" />
              <span className="text-[15px] text-gray-900 truncate">Use “{query.trim()}”</span>
            </button>
          )}

          {[...pinned, ...matches].map((color) => (
            <ValueRow
              key={color}
              label={color}
              selected={color === value}
              swatch={
                <span
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                  style={{ background: colorSwatchStyle(color) }}
                />
              }
              onToggle={() => pick(color)}
            />
          ))}

          {matches.length === 0 && !canCreate && (
            <p className="py-6 text-sm text-gray-400 text-center">No matches.</p>
          )}
        </div>
      </div>
    </div>
  );
}
