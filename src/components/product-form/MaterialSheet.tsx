import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  MATERIAL_SYSTEMS,
  MATERIAL_PRESETS,
  DEFAULT_MATERIAL_SYSTEM,
} from "@/lib/material-options";
import { fuzzyFilter, normalizeForSearch } from "@/lib/fuzzy-search";
import { SystemMenu, ValueRow } from "./value-picker";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

// Material fill-in for a REGULAR (non-variant) product, and for a variant
// product's per-row material. Variant products can also carry Material as a
// real option axis, edited in OptionEditorSheet.
//
// Deliberately the SAME picker as that axis editor -- same genre switcher,
// same full-width rows, same vocabulary (MATERIAL_SYSTEMS) -- because it is
// the same question asked from a different screen. It briefly wasn't: this
// sheet grew its own wrapping-chip layout, which read as a different feature
// over a different list. The shared components live in value-picker.tsx.
//
// The one real difference is arity: an option axis collects several values,
// this collects exactly one, so picking a row replaces the choice instead of
// adding to it and there's no Save/Cancel bar over the list.
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
  const [query, setQuery] = useState("");
  // Genres are shelves in one vocabulary, not rival scales, so this never
  // locks the way Size's UK/US switch does -- see EXCLUSIVE_SYSTEM_OPTIONS in
  // OptionEditorSheet.tsx. Seeded to whichever genre already holds the
  // current value, so reopening lands where the seller left off.
  const [genre, setGenre] = useState(
    () =>
      Object.keys(MATERIAL_SYSTEMS).find((g) => MATERIAL_SYSTEMS[g].includes(initial.trim())) ??
      DEFAULT_MATERIAL_SYSTEM,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Browsing stays inside the chosen genre; searching reaches across all of
  // them, so a fabric never hides just because you happen to be on "Metals".
  const searching = normalizeForSearch(query).length > 0;
  const pool = searching ? MATERIAL_PRESETS : [...MATERIAL_SYSTEMS[genre]];
  const matches = fuzzyFilter(query, pool, (m) => m);

  const trimmed = value.trim();
  // The current pick pins to the top whatever genre it belongs to, the same
  // way the option editor pins chosen values above the pool -- otherwise
  // switching genre makes your own answer vanish off the screen. While
  // searching it obeys the query, so the list never claims a match it doesn't
  // have.
  const chosen = trimmed && (!searching || matches.includes(trimmed)) ? [trimmed] : [];
  const remaining = matches.filter((m) => m !== trimmed);

  const searched = query.trim();
  const canCreate =
    searched.length > 0 &&
    !MATERIAL_PRESETS.some((m) => normalizeForSearch(m) === normalizeForSearch(searched)) &&
    normalizeForSearch(searched) !== normalizeForSearch(trimmed);

  function pick(m: string) {
    setValue(m);
    setQuery("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Material
        </span>
        <button
          type="button"
          onClick={() => onSave(trimmed)}
          disabled={!trimmed}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 focus-within:border-gray-400">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add or search a material"
            className="flex-1 text-base outline-none bg-transparent min-w-0"
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

        {/* Hidden while searching: the results already span every genre, so a
            switcher there would claim to filter something it isn't. */}
        {!searching && (
          <div className="mt-3">
            <SystemMenu
              activeSystem={genre}
              systemKeys={Object.keys(MATERIAL_SYSTEMS)}
              locked={false}
              open={menuOpen}
              onToggle={() => setMenuOpen((v) => !v)}
              onSelect={(key) => {
                setGenre(key);
                setMenuOpen(false);
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 mt-3">
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(searched)}
              className="w-full flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3.5 text-left"
            >
              <Plus size={18} className="text-gray-400 shrink-0" />
              <span className="text-[15px] text-gray-900">
                Add “<span className="font-medium">{searched}</span>”
              </span>
            </button>
          )}

          {chosen.map((m) => (
            <ValueRow key={m} label={m} selected swatch={null} onToggle={() => pick(m)} />
          ))}

          {remaining.map((m) => (
            <ValueRow key={m} label={m} selected={false} swatch={null} onToggle={() => pick(m)} />
          ))}

          {!canCreate && chosen.length === 0 && remaining.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">
              No materials match your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
