import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

export type LocationListItem = { code: string; name: string };

// Above this count, browsing the unfiltered list is more scroll than it's
// worth (e.g. a large country's full city list can run into the thousands)
// -- search still covers the full set, only the idle browse view is capped.
const BROWSE_CAP = 200;

export function LocationListPicker({
  title,
  items,
  allowCustom = false,
  loadingNote,
  onSelect,
  onClose,
}: {
  title: string;
  items: LocationListItem[];
  // Shown above the list while a bigger dataset is still streaming in behind
  // this one (see src/lib/city-data.ts) -- the list stays fully usable.
  loadingNote?: string;
  // The city/state datasets have real gaps (e.g. Lagos only lists 8 of its
  // dozens of LGAs, so "Alimosho" isn't in there at all) -- when true, a
  // typed value that doesn't match anything is still usable via a "Use
  // '<query>'" row, so a real place missing from the list never blocks entry.
  allowCustom?: boolean;
  onSelect: (item: LocationListItem) => void;
  onClose: () => void;
}) {
  useLockedViewport();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, BROWSE_CAP);
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const trimmedSearch = search.trim();
  const hasExactMatch = filtered.some(
    (item) => item.name.toLowerCase() === trimmedSearch.toLowerCase(),
  );
  const showCustomOption = allowCustom && trimmedSearch.length > 0 && !hasExactMatch;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-1 -ml-1" type="button">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-[15px] flex-1 text-center -ml-6">{title}</span>
      </div>

      <div className="px-4 pt-3 pb-2 shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          className="w-full bg-gray-100 rounded-lg px-3 py-2.5 text-base outline-none"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {showCustomOption && (
          <button
            onClick={() => onSelect({ code: trimmedSearch, name: trimmedSearch })}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 text-left bg-gray-50"
            type="button"
          >
            <span className="text-[15px] text-gray-900">
              Use "<span className="font-medium">{trimmedSearch}</span>"
            </span>
          </button>
        )}
        {filtered.length === 0 && !showCustomOption ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Nothing found.</p>
        ) : (
          filtered.map((item) => (
            <button
              key={item.code}
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 text-left"
              type="button"
            >
              <span className="text-[15px] text-gray-900">{item.name}</span>
              <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
            </button>
          ))
        )}
        {!search.trim() && items.length > BROWSE_CAP && (
          <p className="px-4 py-4 text-xs text-gray-400 text-center">
            Showing the first {BROWSE_CAP} of {items.length} — type to search the rest.
          </p>
        )}
      </div>
    </div>
  );
}
