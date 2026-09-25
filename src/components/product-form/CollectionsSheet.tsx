import { useEffect, useState } from "react";
import { X, Search, ImageIcon, Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { CollectionProductsViewSheet } from "./CollectionProductsViewSheet";

type CollectionRow = {
  id: string;
  title: string;
  image_url: string | null;
  count: number;
};

// Picker for *existing* collections only — creating one happens on its own
// route (see the empty-state CTA below), not inline in this sheet.
export function CollectionsSheet({
  storeId,
  selectedIds,
  onDone,
  onClose,
  onCreateNew,
}: {
  storeId: string;
  selectedIds: string[];
  onDone: (ids: string[]) => void;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  useLockedViewport();
  // See PricingSheet's identical comment -- keeps the sticky "N selected /
  // Done" pill reachable above the keyboard while searching.
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboardInset = useKeyboardInset(fieldFocused);

  const [collections, setCollections] = useState<CollectionRow[] | null>(null); // null = loading
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [query, setQuery] = useState("");
  // Deleting a collection is destructive and cascades, so the trash icon only
  // arms a confirm step -- a single mis-tap can't remove anything.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // View-only look inside a collection's products -- separate from `selected`
  // (this product's own pick), so opening it can never accidentally toggle
  // membership. There's no add/remove here on purpose: a seller mid-creating
  // an unrelated product shouldn't be able to change a collection's contents
  // from this sheet, only see them.
  const [viewingCollection, setViewingCollection] = useState<CollectionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cols } = await supabase
        .from("collections")
        .select("id, title, image_url")
        .eq("store_id", storeId)
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
  }, [storeId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Deletes the collection everywhere (not just off this product) -- there
  // was previously no way for a seller to remove a collection they created
  // by mistake or no longer use. Cascades to product_collections, so no
  // separate cleanup needed there.
  async function handleDelete(id: string) {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) {
      console.error("CollectionsSheet: failed to delete collection", error);
      return;
    }
    setPendingDeleteId(null);
    setCollections((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const filtered = (collections ?? []).filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]"
      style={{ paddingBottom: keyboardInset }}
    >
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
                onFocus={() => setFieldFocused(true)}
                onBlur={() => setFieldFocused(false)}
                placeholder="Filter collections"
                className="bg-transparent text-base flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <div key={c.id} className="flex items-center border-b border-gray-50">
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${c.title}`}
                    className="p-4 -mr-1 shrink-0"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-200 ${
                        isSelected ? "bg-black border-black" : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check size={13} className="text-white oak-motion-pop" />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingCollection(c)}
                    aria-label={`View products in ${c.title}`}
                    className="flex-1 min-w-0 flex items-center gap-3 py-3 pr-2 text-left"
                  >
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
                  {pendingDeleteId === c.id ? (
                    <span className="flex items-center gap-2 pr-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="text-xs text-gray-500 px-2 py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-xs font-medium text-white bg-red-600 rounded-full px-3 py-1.5"
                      >
                        Delete
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(c.id)}
                      aria-label={`Delete ${c.title}`}
                      className="p-3 text-gray-300 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</p>
            )}
          </div>

          {/* Floating pill rather than an edge-to-edge bar: it reads as a
              control sitting ON the list rather than a second, competing
              chrome bar welded to the browser's own. The wrapper keeps the
              gap below it (and fades the list out behind it) while staying
              sticky, so the pill never sits flush against the phone's
              bottom edge or the browser toolbar under it. */}
          <div className="sticky bottom-0 shrink-0 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] bg-gradient-to-t from-white via-white/95 to-transparent">
            <div className="bg-black text-white rounded-full h-[60px] pl-6 pr-2 flex items-center justify-between shadow-lg shadow-black/20">
              <span className="text-sm">{selected.size} selected</span>
              <button
                type="button"
                onClick={() => onDone([...selected])}
                className="text-sm font-medium bg-white/15 rounded-full px-6 py-3 oak-motion-control"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {viewingCollection && (
        <CollectionProductsViewSheet
          collectionId={viewingCollection.id}
          collectionTitle={viewingCollection.title}
          onClose={() => setViewingCollection(null)}
        />
      )}
    </div>
  );
}
