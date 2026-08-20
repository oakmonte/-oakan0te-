import { useEffect, useState } from "react";
import { X, Search, ImageIcon, Check, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

// TODO: dev-only, matches store.products_.new.tsx / store.products.tsx.
// Revert before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

type CollectionRow = {
  id: string;
  title: string;
  image_url: string | null;
  count: number;
};

// Picker for *existing* collections only — creating one happens on its own
// route (see the empty-state CTA below), not inline in this sheet.
export function CollectionsSheet({
  selectedIds,
  onDone,
  onClose,
  onCreateNew,
}: {
  selectedIds: string[];
  onDone: (ids: string[]) => void;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const [collections, setCollections] = useState<CollectionRow[] | null>(null); // null = loading
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cols } = await supabase
        .from("collections")
        .select("id, title, image_url")
        .eq("store_id", DEV_STORE_ID)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      const ids = (cols ?? []).map((c) => c.id);
      const { data: links } = ids.length
        ? await supabase
            .from("product_collections")
            .select("collection_id")
            .in("collection_id", ids)
        : { data: [] as { collection_id: string }[] };
      if (cancelled) return;

      const counts = new Map<string, number>();
      for (const l of links ?? [])
        counts.set(l.collection_id, (counts.get(l.collection_id) ?? 0) + 1);

      setCollections((cols ?? []).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = (collections ?? []).filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Collections
        </span>
        <button
          onClick={onCreateNew}
          type="button"
          aria-label="Create collection"
          className="p-1 -mr-1"
        >
          <Plus size={20} className="text-gray-900" />
        </button>
      </div>

      {collections !== null && collections.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[15px] text-gray-400">No collections yet</p>
          <button
            type="button"
            onClick={onCreateNew}
            className="bg-black text-white text-sm font-medium rounded-full px-5 py-2.5"
          >
            Create collection
          </button>
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
                placeholder="Filter collections"
                className="bg-transparent text-base flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${c.title}`}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-200 ${
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
                  <span className="min-w-0">
                    <span className="block text-[15px] text-gray-900 truncate">{c.title}</span>
                    <span className="block text-xs text-gray-400">
                      {c.count} product{c.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</p>
            )}
          </div>

          <div className="sticky bottom-0 bg-black text-white px-4 h-14 flex items-center justify-between shrink-0">
            <span className="text-sm">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => onDone([...selected])}
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
