import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ImageIcon, Check, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useLongPress } from "@/hooks/use-long-press";
import { deleteCollection } from "@/lib/collections";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CollectionRow = {
  id: string;
  title: string;
  image_url: string | null;
  count: number;
};

export function CollectionsPanel() {
  const navigate = useNavigate();
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  function toggleSelected(id: string) {
    // A stale "Couldn't delete: …" from a previous failed attempt shouldn't
    // linger and reappear over a totally different selection later.
    setDeleteError("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setConfirmDeleteOpen(false);
    setDeleting(true);
    setDeleteError("");
    const { error } = await deleteCollection([...selectedIds], false);
    setDeleting(false);
    if (error) {
      // Selection stays intact so retrying doesn't require re-picking
      // everything -- a silent console.error previously let a failed delete
      // look to the seller like nothing happened.
      setDeleteError("Couldn't delete: " + error);
      return;
    }
    setCollections((prev) => (prev ?? []).filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
  }

  if (storeLoading) return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (!storeId)
    return (
      <div className="px-4 py-8 text-sm text-sd-ink-faint">No store found on this account.</div>
    );

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          type="button"
          onClick={() => navigate({ to: "/store/collections/new" })}
          aria-label="Add collection"
          className="p-2 rounded-lg bg-sd-ink text-sd-bg oak-motion-control active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Only while the store has zero collections -- once the first one
          exists, the concept doesn't need re-explaining every visit. */}
      {collections !== null && collections.length === 0 && (
        <p className="text-xs text-sd-ink-faint text-center mb-4 animate-in fade-in duration-300">
          Complimentary pieces can be grouped as collections.
        </p>
      )}

      {collections === null ? (
        <div className="text-sm text-sd-ink-faint text-center py-12">Loading…</div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 animate-in fade-in duration-300">
          <p className="text-sm text-sd-ink-faint text-center">No collections yet.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/store/collections/new" })}
            className="bg-sd-ink text-sd-bg text-sm font-medium rounded-full px-5 py-2.5"
          >
            Create collection
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
          {collections.map((c) => (
            <CollectionListRow
              key={c.id}
              collection={c}
              selectMode={selectMode}
              selected={selectedIds.has(c.id)}
              onLongPress={() => toggleSelected(c.id)}
              onTap={() =>
                selectMode
                  ? toggleSelected(c.id)
                  : navigate({ to: "/store/collections/$id", params: { id: c.id } })
              }
            />
          ))}
        </div>
      )}

      {selectMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-sd-surface border-t border-sd-line pb-[env(safe-area-inset-bottom)] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
          {deleteError && (
            <p className="px-4 pt-2 text-xs text-sd-danger-ink animate-in fade-in slide-in-from-top-1 duration-200">
              {deleteError}
            </p>
          )}
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setDeleteError("");
              }}
              aria-label="Cancel selection"
              className="p-2 -ml-2 rounded-full oak-motion-control active:scale-90"
            >
              <X size={18} className="text-sd-ink-muted" />
            </button>
            <span className="text-sm font-medium text-sd-ink">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
              aria-label="Delete selected"
              className="p-2 -mr-2 rounded-full text-sd-danger-ink disabled:opacity-50 oak-motion-control active:scale-90"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} collection{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The products in them are kept — only the collections themselves are removed. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-sd-ink text-sd-bg rounded-full"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollectionListRow({
  collection: c,
  selectMode,
  selected,
  onLongPress,
  onTap,
}: {
  collection: CollectionRow;
  selectMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  onTap: () => void;
}) {
  const longPress = useLongPress(onLongPress, { onTap });
  return (
    <button
      type="button"
      {...longPress}
      style={{ WebkitTouchCallout: "none" }}
      className="w-full flex items-center gap-3 border border-sd-line rounded-xl p-3 text-left select-none oak-motion-control active:scale-[0.99]"
    >
      {selectMode && (
        <span
          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-150 ${
            selected ? "bg-sd-ink border-sd-ink" : "border-sd-line bg-sd-surface"
          }`}
        >
          {selected && <Check size={13} className="text-sd-bg oak-motion-pop" />}
        </span>
      )}
      <div className="w-10 h-10 rounded-lg bg-sd-soft flex items-center justify-center overflow-hidden shrink-0">
        {c.image_url ? (
          <img src={c.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={16} className="text-sd-ink-faint" />
        )}
      </div>
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{c.title}</span>
      <span className="text-xs text-sd-ink-faint shrink-0">
        {c.count} product{c.count === 1 ? "" : "s"}
      </span>
    </button>
  );
}
