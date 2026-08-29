import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";

export const Route = createFileRoute("/store/collections")({
  component: StoreCollections,
});

type CollectionRow = {
  id: string;
  title: string;
  image_url: string | null;
  count: number;
};

function StoreCollections() {
  const navigate = useNavigate();
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  // Deleting a collection is destructive and cascades, so the trash icon only
  // arms a confirm step -- a single mis-tap can't remove anything.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
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

  async function handleDelete(id: string) {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) {
      console.error("StoreCollections: failed to delete collection", error);
      return;
    }
    setPendingDeleteId(null);
    setCollections((prev) => prev?.filter((c) => c.id !== id) ?? prev);
  }

  if (storeLoading) return <div className="px-4 py-8 text-sm text-gray-400">Loading…</div>;
  if (!storeId)
    return <div className="px-4 py-8 text-sm text-gray-400">No store found on this account.</div>;

  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-semibold text-gray-900">Collections</span>
        <button
          type="button"
          onClick={() => navigate({ to: "/store/collections/new" })}
          aria-label="Add collection"
          className="p-2 rounded-lg bg-black text-white oak-motion-control active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>

      {collections === null ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 animate-in fade-in duration-300">
          <p className="text-sm text-gray-400 text-center">No collections yet.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/store/collections/new" })}
            className="bg-black text-white text-sm font-medium rounded-full px-5 py-2.5"
          >
            Create collection
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
          {collections.map((c) => (
            <div
              key={c.id}
              className="border border-gray-100 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {c.count} product{c.count === 1 ? "" : "s"}
                </p>
              </div>
              {pendingDeleteId === c.id ? (
                <span className="flex items-center gap-2 shrink-0">
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
                  className="p-2 text-gray-300 shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
