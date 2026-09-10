import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { MATERIAL_GROUPS, MATERIAL_PRESETS } from "@/lib/material-options";
import { fuzzyFilter, normalizeForSearch } from "@/lib/fuzzy-search";
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

  // The chosen material, and the search text, kept apart. Tapping a chip
  // clears the search (but not the choice) -- with one shared box, picking
  // "Cotton" instantly collapsed the list to just the cotton entries, which
  // reads as the list breaking rather than as a selection being made.
  const [value, setValue] = useState(initial);
  const [query, setQuery] = useState("");

  // Fuzzy, not `includes`: a seller who types "chifon" or "polyster" should
  // land on the real preset, since an empty result pushes them into a
  // one-off spelling the GSM table won't recognise (see fuzzy-search.ts).
  const groups = MATERIAL_GROUPS.map((g) => ({
    ...g,
    materials: fuzzyFilter(query, g.materials, (m) => m),
  })).filter((g) => g.materials.length > 0);

  const trimmed = value.trim();
  const isCustom = trimmed.length > 0 && !MATERIAL_PRESETS.includes(trimmed);
  // Offered whenever the search isn't already an exact preset name, so a
  // fabric we don't list is always one tap away rather than needing the
  // seller to guess that the search box doubles as the value.
  const searched = query.trim();
  const canUseTyped =
    searched.length > 0 &&
    !MATERIAL_PRESETS.some((m) => normalizeForSearch(m) === normalizeForSearch(searched));

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

      {/* Pinned above the scroll area, so it stays reachable however far down
          the ~90 presets the seller has scrolled. No autoFocus: the presets
          are the primary affordance, and opening the keyboard on mount would
          cover them before any had been seen. */}
      <div className="sticky top-14 z-10 bg-white px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 focus-within:border-gray-400">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search materials"
            className="flex-1 text-[15px] outline-none bg-transparent min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="p-1 -mr-1 rounded-full bg-gray-100 shrink-0"
            >
              <X size={12} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {isCustom && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-2">Yours</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-black px-3.5 py-2 text-sm font-medium text-white">
              <Check size={13} />
              {trimmed}
            </span>
          </div>
        )}

        {canUseTyped && (
          <button
            type="button"
            onClick={() => {
              setValue(searched);
              setQuery("");
            }}
            className="w-full mb-5 rounded-xl border border-gray-200 px-4 py-3.5 text-left text-[15px] text-gray-900 oak-motion-control"
          >
            Use “<span className="font-medium">{searched}</span>”
          </button>
        )}

        {groups.length === 0 ? (
          <p className="text-xs text-gray-400">
            No material matches that. Tap “Use …” above to add it as your own.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="text-xs text-gray-400 mb-2">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.materials.map((m) => {
                  const isSelected = value === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setValue(m);
                        setQuery("");
                      }}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium oak-motion-control ${
                        isSelected
                          ? "bg-black text-white border-black"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
