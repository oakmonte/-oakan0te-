import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { deleteDrop, dropStatusLabel } from "@/lib/drops";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import { CollectionPickerSheet } from "@/components/product-form/CollectionPickerSheet";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/store/drops_/$id")({
  component: DropDetail,
});

const RETURN_TO = { to: "/store/products", search: { tab: "Drops" } } as const;

type DropInfo = {
  id: string;
  title: string;
  cover_image_url: string | null;
  collection_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type ProductRow = {
  id: string;
  title: string | null;
  main_image_url: string | null;
};

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time -- toISOString() is
// UTC and Date's getters are local, so this has to be built by hand rather
// than sliced off an ISO string.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DropDetail() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { storeId } = useActiveStoreId();

  const [drop, setDrop] = useState<DropInfo | null | undefined>(undefined); // undefined = loading, null = not found
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [productsSheetOpen, setProductsSheetOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [productsError, setProductsError] = useState("");

  const [timerEnabled, setTimerEnabled] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [savingTimer, setSavingTimer] = useState(false);
  const [timerError, setTimerError] = useState("");

  const fetchDrop = useCallback(async () => {
    if (!storeId) return;
    // storeId scopes the read as a defense-in-depth check -- RLS is off on
    // `drops` (see the drops migration), so a guessed/spoofed id in the URL
    // otherwise resolves fine. Everything else on this page (product edits,
    // the timer update, the collection swap) only ever acts on `id` once
    // this fetch has already confirmed it belongs to the active store.
    const { data } = await supabase
      .from("drops")
      .select("id, title, cover_image_url, collection_id, starts_at, ends_at")
      .eq("id", id)
      .eq("store_id", storeId)
      .maybeSingle();
    setDrop(data ?? null);
    if (data) {
      setTimerEnabled(!!(data.starts_at || data.ends_at));
      setStartsAt(toLocalInputValue(data.starts_at));
      setEndsAt(toLocalInputValue(data.ends_at));
    }
  }, [id, storeId]);

  const fetchProducts = useCallback(
    async (collectionId: string | null) => {
      if (collectionId) {
        const { data: cols } = await supabase
          .from("collections")
          .select("title")
          .eq("id", collectionId)
          .maybeSingle();
        setCollectionTitle(cols?.title ?? null);

        const { data: links } = await supabase
          .from("product_collections")
          .select("product_id")
          .eq("collection_id", collectionId);
        await loadProductRows((links ?? []).map((l) => l.product_id));
        return;
      }
      setCollectionTitle(null);
      const { data: links } = await supabase
        .from("drop_products")
        .select("product_id")
        .eq("drop_id", id);
      await loadProductRows((links ?? []).map((l) => l.product_id));
    },
    [id],
  );

  async function loadProductRows(productIds: string[]) {
    if (productIds.length === 0) {
      setProducts([]);
      return;
    }
    const { data: rows } = await supabase
      .from("products")
      .select("id, title, product_variants(main_image_url)")
      .in("id", productIds);
    setProducts(
      (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        main_image_url: r.product_variants?.[0]?.main_image_url ?? null,
      })),
    );
  }

  useEffect(() => {
    fetchDrop();
  }, [fetchDrop]);

  useEffect(() => {
    if (drop) fetchProducts(drop.collection_id);
  }, [drop, fetchProducts]);

  async function handleApplyProducts(nextIds: string[]) {
    const currentIds = new Set((products ?? []).map((p) => p.id));
    const nextSet = new Set(nextIds);
    const toAdd = nextIds.filter((pid) => !currentIds.has(pid));
    const toRemove = [...currentIds].filter((pid) => !nextSet.has(pid));

    if (toAdd.length > 0) {
      // upsert, not insert -- the sheet opens with whatever `products` has
      // loaded so far as its selection. If it's tapped before that fetch
      // resolves, an already-linked product looks unselected and re-adding
      // it would otherwise fail the table's (drop_id, product_id) unique
      // key and silently drop the whole batch.
      const { error } = await supabase.from("drop_products").upsert(
        toAdd.map((product_id) => ({ product_id, drop_id: id })),
        { onConflict: "drop_id,product_id", ignoreDuplicates: true },
      );
      if (error) {
        setProductsError("Couldn't add products: " + error.message);
        return;
      }
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("drop_products")
        .delete()
        .eq("drop_id", id)
        .in("product_id", toRemove);
      if (error) {
        setProductsError("Couldn't remove products: " + error.message);
        return;
      }
    }
    setProductsError("");
    setProductsSheetOpen(false);
    fetchProducts(null);
  }

  async function handleChangeCollection(newCollectionId: string | null) {
    setCollectionPickerOpen(false);
    if (!newCollectionId || !storeId) return;
    const { error } = await supabase
      .from("drops")
      .update({ collection_id: newCollectionId })
      .eq("id", id)
      .eq("store_id", storeId);
    if (error) {
      setProductsError("Couldn't change collection: " + error.message);
    } else {
      setProductsError("");
      setDrop((prev) => (prev ? { ...prev, collection_id: newCollectionId } : prev));
      fetchProducts(newCollectionId);
    }
  }

  async function handleSaveTimer() {
    if (!storeId) return;
    const nextStarts = timerEnabled && startsAt ? new Date(startsAt) : null;
    const nextEnds = timerEnabled && endsAt ? new Date(endsAt) : null;
    if (nextStarts && nextEnds && nextEnds <= nextStarts) {
      setTimerError("End time must be after the start time");
      return;
    }
    setSavingTimer(true);
    setTimerError("");
    const { error } = await supabase
      .from("drops")
      .update({
        starts_at: nextStarts ? nextStarts.toISOString() : null,
        ends_at: nextEnds ? nextEnds.toISOString() : null,
      })
      .eq("id", id)
      .eq("store_id", storeId);
    setSavingTimer(false);
    if (error) {
      setTimerError("Couldn't save: " + error.message);
      return;
    }
    setDrop((prev) =>
      prev
        ? {
            ...prev,
            starts_at: nextStarts ? nextStarts.toISOString() : null,
            ends_at: nextEnds ? nextEnds.toISOString() : null,
          }
        : prev,
    );
  }

  async function handleDelete() {
    if (!storeId) return;
    setDeleting(true);
    const { error } = await deleteDrop(id, storeId);
    setDeleting(false);
    if (error) {
      setProductsError("Couldn't delete: " + error);
      return;
    }
    navigate(RETURN_TO);
  }

  if (drop === undefined)
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (drop === null)
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Drop not found.</div>;

  return (
    <div className="min-h-dvh bg-sd-surface pb-10">
      <div className="sticky top-14 z-20 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <BackButton
          icon="chevron"
          size={18}
          label="Drops"
          to={RETURN_TO}
          className="text-sm text-sd-ink-muted flex items-center gap-0.5 -ml-1"
        />
        <span className="font-semibold text-[15px] truncate max-w-[45%]">{drop.title}</span>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          aria-label="Delete drop"
          className="p-1 -mr-1 text-sd-danger-ink"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="px-4 py-4 flex items-center gap-3 border-b-8 border-sd-line/50">
        <div className="w-14 h-14 rounded-xl bg-sd-soft flex items-center justify-center overflow-hidden shrink-0">
          {drop.cover_image_url ? (
            <img src={drop.cover_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-sd-ink-faint" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-sd-ink truncate">{drop.title}</p>
          <p className="text-xs text-sd-ink-muted">
            {dropStatusLabel(drop.starts_at, drop.ends_at)}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 border-b-8 border-sd-line/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] text-sd-ink">Timer</p>
            <p className="text-xs text-sd-ink-faint mt-0.5">
              {timerEnabled ? "Release or end this drop at a set time" : "Live right now, no end"}
            </p>
          </div>
          <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
        </div>

        {timerEnabled && (
          <div className="mt-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-sd-ink-faint">Starts (optional)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="rounded-lg border border-sd-line px-3 py-2 text-sm text-sd-ink bg-sd-surface"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-sd-ink-faint">Ends (optional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded-lg border border-sd-line px-3 py-2 text-sm text-sd-ink bg-sd-surface"
              />
            </label>
          </div>
        )}

        {timerError && <p className="mt-2 text-xs text-sd-danger-ink">{timerError}</p>}
        <button
          type="button"
          onClick={handleSaveTimer}
          disabled={savingTimer}
          className="mt-3 text-sm font-medium text-sd-ink disabled:text-sd-ink-faint"
        >
          {savingTimer ? "Saving…" : "Save timer"}
        </button>
      </div>

      {productsError && <p className="px-4 pt-4 text-xs text-sd-danger-ink">{productsError}</p>}

      {drop.collection_id ? (
        <div className="px-4 py-4">
          <p className="text-xs text-sd-ink-faint mb-2">In collection</p>
          <button
            type="button"
            onClick={() => setCollectionPickerOpen(true)}
            className="w-full flex items-center justify-between border border-sd-line rounded-xl p-3 text-left oak-motion-control active:scale-[0.99]"
          >
            <span className="text-sm font-medium text-sd-ink">{collectionTitle ?? "…"}</span>
            <span className="text-xs text-sd-ink-faint">Change</span>
          </button>
        </div>
      ) : (
        <div className="px-4 py-4">
          <button
            type="button"
            // Disabled while the current list is still loading -- opening the
            // picker before `products` resolves would show every product as
            // unselected, so re-picking an already-linked one hits the
            // (drop_id, product_id) unique key on save.
            onClick={() => setProductsSheetOpen(true)}
            disabled={products === null}
            className="w-full flex items-center justify-center gap-2 border border-sd-line rounded-xl py-3 text-sm font-medium text-sd-ink disabled:opacity-50 oak-motion-control active:scale-[0.99]"
          >
            <Plus size={16} />
            Add products
          </button>
        </div>
      )}

      {products === null ? (
        <div className="text-sm text-sd-ink-faint text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-sd-ink-faint text-center py-12 animate-in fade-in duration-300">
          No products in this drop yet.
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-3 animate-in fade-in duration-300">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ to: "/store/products/$id", params: { id: p.id } })}
              className="w-full flex items-center gap-3 border border-sd-line rounded-xl p-3 text-left oak-motion-control active:scale-[0.99]"
            >
              <span className="w-12 h-12 rounded-lg bg-sd-soft flex items-center justify-center overflow-hidden shrink-0">
                {p.main_image_url ? (
                  <img src={p.main_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-sd-ink-faint" />
                )}
              </span>
              <span className="text-sm font-medium truncate">{p.title ?? "Untitled"}</span>
            </button>
          ))}
        </div>
      )}

      {productsSheetOpen && storeId && (
        <ProductsSheet
          storeId={storeId}
          selectedIds={(products ?? []).map((p) => p.id)}
          onDone={handleApplyProducts}
          onClose={() => setProductsSheetOpen(false)}
        />
      )}

      {collectionPickerOpen && storeId && (
        <CollectionPickerSheet
          storeId={storeId}
          selectedId={drop.collection_id}
          onDone={handleChangeCollection}
          onClose={() => setCollectionPickerOpen(false)}
        />
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this drop?</AlertDialogTitle>
            <AlertDialogDescription>
              The products in it are kept — only the drop itself is removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-sd-ink text-sd-bg rounded-full"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
