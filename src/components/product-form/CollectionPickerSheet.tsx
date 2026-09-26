import { useEffect, useState } from "react";
import { X, Search, ImageIcon, Check } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

type CollectionRow = {
  id: string;
  title: string;
  image_url: string | null;
};

// Single-select picker for a store's *existing* collections, used from the
// New/Edit Drop forms when a drop wraps a whole collection rather than a
// hand-picked product set. Same shell and interaction model as
// ProductsSheet.tsx (search, browse, Done to confirm) — the difference is a
// radio dot instead of a checkbox, since a drop can only wrap one
// collection at a time.
export function CollectionPickerSheet({
  storeId,
  selectedId,
  onDone,
  onClose,
}: {
  storeId: string;
  selectedId: string | null;
  onDone: (id: string | null) => void;
  onClose: () => void;
}) {
  useLockedViewport();
  // See PricingSheet's identical comment -- keeps the sticky "selected /
  // Done" bar reachable above the keyboard while searching.
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboardInset = useKeyboardInset(fieldFocused);

  const [collections, setCollections] = useState<CollectionRow[] | null>(null); // null = loading
  const [selected, setSelected] = useState<string | null>(selectedId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("collections")
        .select("id, title, image_url")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setCollections(rows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filtered = (collections ?? []).filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out"
      style={{ paddingBottom: keyboardInset }}
    >
      <div className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Collections
        </span>
        <span className="w-6" />
      </div>

      {collections !== null && collections.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[15px] text-gray-400">No collections yet</p>
        </div>
      )}

      {collections !== null && collections.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFieldFocused(true)}
                onBlur={() => setFieldFocused(false)}
                placeholder="Search collections"
                className="bg-transparent text-base flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((c) => {
              const isSelected = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : c.id)}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${c.title}`}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50"
                >
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isSelected ? "bg-black border-black" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-white oak-motion-pop" />}
                  </span>
                  <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-gray-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] text-gray-900 truncate">
                    {c.title}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</p>
            )}
          </div>

          <div className="bg-black text-white px-4 min-h-14 pb-[env(safe-area-inset-bottom)] flex items-center justify-between shrink-0">
            <span className="text-sm">{selected ? "1 selected" : "None selected"}</span>
            <button
              type="button"
              onClick={() => onDone(selected)}
              className="text-sm font-medium bg-white/15 rounded-full px-4 py-2"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
