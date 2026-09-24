import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ImageIcon, Check, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useLongPress } from "@/hooks/use-long-press";
import { deleteDrop, dropStatusLabel } from "@/lib/drops";
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

type DropRow = {
  id: string;
  title: string;
  cover_image_url: string | null;
  collection_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  count: number;
};

export function DropsPanel() {
  const navigate = useNavigate();
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const [drops, setDrops] = useState<DropRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("drops")
        .select("id, title, cover_image_url, collection_id, starts_at, ends_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      // A drop's product count comes from two different places depending on
      // which mode it's in (see the drops migration): collection-mode drops
      // read it live off product_collections, product-set-mode drops off
      // drop_products. Two counting passes, same shape as CollectionsPanel's
      // single one.
      const collectionIds = [
        ...new Set((rows ?? []).flatMap((r) => (r.collection_id ? [r.collection_id] : []))),
      ];
      const dropIds = (rows ?? []).filter((r) => !r.collection_id).map((r) => r.id);

      const [{ data: collectionLinks }, { data: dropLinks }] = await Promise.all([
        collectionIds.length
          ? supabase
              .from("product_collections")
              .select("collection_id")
              .in("collection_id", collectionIds)
          : Promise.resolve({ data: [] as { collection_id: string }[] }),
        dropIds.length
          ? supabase.from("drop_products").select("drop_id").in("drop_id", dropIds)
          : Promise.resolve({ data: [] as { drop_id: string }[] }),
      ]);
      if (cancelled) return;

      const byCollection = new Map<string, number>();
      for (const l of collectionLinks ?? [])
        byCollection.set(l.collection_id, (byCollection.get(l.collection_id) ?? 0) + 1);
      const byDrop = new Map<string, number>();
      for (const l of dropLinks ?? []) byDrop.set(l.drop_id, (byDrop.get(l.drop_id) ?? 0) + 1);

      setDrops(
        (rows ?? []).map((r) => ({
          ...r,
          count: r.collection_id
            ? (byCollection.get(r.collection_id) ?? 0)
            : (byDrop.get(r.id) ?? 0),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  function toggleSelected(id: string) {
    setDeleteError("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!storeId) return;
    setConfirmDeleteOpen(false);
    setDeleting(true);
    setDeleteError("");
    const { error } = await deleteDrop([...selectedIds], storeId);
    setDeleting(false);
    if (error) {
      setDeleteError("Couldn't delete: " + error);
      return;
    }
    setDrops((prev) => (prev ?? []).filter((d) => !selectedIds.has(d.id)));
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
          onClick={() => navigate({ to: "/store/drops/new" })}
          aria-label="Create drop"
          className="p-2 rounded-lg bg-sd-ink text-sd-bg oak-motion-control active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>

      {drops !== null && drops.length === 0 && (
        <p className="text-xs text-sd-ink-faint text-center mb-4 animate-in fade-in duration-300">
          Give a collection or a handful of products a timer, or just announce them as new.
        </p>
      )}

      {drops === null ? (
        <div className="text-sm text-sd-ink-faint text-center py-12">Loading…</div>
      ) : drops.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 animate-in fade-in duration-300">
          <p className="text-sm text-sd-ink-faint text-center">No drops yet.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/store/drops/new" })}
            className="bg-sd-ink text-sd-bg text-sm font-medium rounded-full px-5 py-2.5"
          >
            Create drop
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
          {drops.map((d) => (
            <DropListRow
              key={d.id}
              drop={d}
              selectMode={selectMode}
              selected={selectedIds.has(d.id)}
              onLongPress={() => toggleSelected(d.id)}
              onTap={() =>
                selectMode
                  ? toggleSelected(d.id)
                  : navigate({ to: "/store/drops/$id", params: { id: d.id } })
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
              Delete {selectedIds.size} drop{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The products in them are kept — only the drop itself is removed. This can't be undone.
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

function DropListRow({
  drop: d,
  selectMode,
  selected,
  onLongPress,
  onTap,
}: {
  drop: DropRow;
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
        {d.cover_image_url ? (
          <img src={d.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={16} className="text-sd-ink-faint" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{d.title}</p>
        <p className="text-xs text-sd-ink-faint truncate">
          {d.count} product{d.count === 1 ? "" : "s"}
        </p>
      </div>
      <span className="text-[11px] px-2 py-1 rounded-full bg-sd-soft text-sd-ink-muted tabular-nums shrink-0">
        {dropStatusLabel(d.starts_at, d.ends_at)}
      </span>
    </button>
  );
}
