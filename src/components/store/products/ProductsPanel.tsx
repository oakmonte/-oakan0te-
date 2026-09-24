import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Upload, Check, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { CreateProductTypeModal } from "@/components/product-form/CreateProductTypeModal";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useLongPress } from "@/hooks/use-long-press";
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

// "Uploaded" isn't a status like the other three — it's every product whose
// source_platform isn't "manual" (csv/shopify/bumpa import), regardless of
// draft/active. Filtered separately below rather than folded into the status
// column.
const TABS = ["All", "Active", "Draft", "Archived", "Uploaded"] as const;

type ProductRow = {
  id: string;
  title: string | null;
  status: string;
  product_type: string | null;
  source_platform: string | null;
  product_variants: {
    price: number | null;
    stock_qty: number | null;
    main_image_url: string | null;
  }[];
};

// product_tags has no ON DELETE CASCADE on product_id (unlike
// product_variants/product_options/product_collections/
// product_size_measurements, which all cascade), so it has to be cleared
// first or the products delete fails on the FK constraint -- same order as
// the single-product delete in store.products_.$id.tsx's handleDeleteProduct,
// just as one .in() each instead of N single-row deletes.
// storeId scopes the actual delete as a defense-in-depth check -- RLS is off
// on `products` (see root CLAUDE.md), so with a contaminated id list this is
// the only thing standing between "delete my own products" and deleting
// someone else's.
// Returns which ids actually got deleted rather than a bare ok/error --
// `ids` can legitimately include one that's already gone (deleted from
// another tab, or the list was just stale), and treating that as a hard
// failure would leave it stuck on screen forever with no way to clear it
// (see the caller). deletedIds.length < ids.length without `error` set is
// exactly that case: the survivors are reported back so the caller can drop
// only those.
async function deleteProducts(
  ids: string[],
  storeId: string,
): Promise<{ deletedIds: string[]; error: string | null }> {
  const { error: tagsErr } = await supabase.from("product_tags").delete().in("product_id", ids);
  if (tagsErr) return { deletedIds: [], error: tagsErr.message };
  // PostgREST returns no error for a delete that matches zero rows -- if the
  // store_id scope above ever filtered out every id (e.g. the active store
  // changed underneath an armed selection), a bare unchecked delete would
  // report success despite having deleted no `products` row at all, after
  // those ids' tags were already gone for good above. Asking for the
  // deleted rows back is what actually confirms any of it happened.
  const { data, error } = await supabase
    .from("products")
    .delete()
    .in("id", ids)
    .eq("store_id", storeId)
    .select("id");
  if (error) return { deletedIds: [], error: error.message };
  const deletedIds = (data ?? []).map((r) => r.id);
  if (deletedIds.length === 0) {
    return { deletedIds: [], error: "Couldn't delete — try again." };
  }
  return { deletedIds, error: null };
}

export function ProductsPanel({ checklist }: { checklist?: boolean }) {
  const navigate = useNavigate();
  const { storeId, loading: storeLoading } = useActiveStoreId();

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setListLoading(true);
    let query = supabase
      .from("products")
      .select(
        "id, title, status, product_type, source_platform, product_variants(price, stock_qty, main_image_url)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (activeTab === "Uploaded") query = query.not("source_platform", "eq", "manual");
    else if (activeTab !== "All") query = query.eq("status", activeTab.toLowerCase());
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);

    const { data, error } = await query;
    // Selection is intentionally left untouched by a tab switch or a search
    // keystroke -- both re-run this same fetch (search has no debounce), and
    // pruning selectedIds down to "whatever's on screen now" here used to
    // wipe an in-progress cross-tab/cross-search multi-select on literally
    // every character typed. A selected id that's since gone stale (deleted
    // elsewhere) is reconciled at delete time instead -- see handleBulkDelete.
    if (!error && data) setProducts(data as ProductRow[]);
    setListLoading(false);
  }, [storeId, activeTab, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    if (!storeId) return;
    setConfirmDeleteOpen(false);
    setDeleting(true);
    setDeleteError("");
    const ids = [...selectedIds];
    const { deletedIds, error } = await deleteProducts(ids, storeId);
    setDeleting(false);
    if (error) {
      // Selection is left intact (not cleared) so retrying doesn't require
      // re-picking everything -- a silent console.error here previously let
      // a partial failure (tags deleted, products delete itself then
      // failing) look to the seller like nothing happened at all.
      setDeleteError("Couldn't delete: " + error);
      return;
    }
    const deleted = new Set(deletedIds);
    setProducts((prev) => prev.filter((p) => !deleted.has(p.id)));
    // Only the ids that actually got deleted are dropped from the
    // selection -- if one was already gone (stale list, deleted elsewhere)
    // the rest of a real Supabase error would still leave the survivors
    // selected for a retry, same as the error branch above.
    setSelectedIds((prev) => new Set([...prev].filter((id) => !deleted.has(id))));
    if (deletedIds.length < ids.length) {
      setDeleteError("Some of the selected products were already gone — the rest were deleted.");
    }
  }

  if (storeLoading) return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (!storeId)
    return (
      <div className="px-4 py-8 text-sm text-sd-ink-faint">No store found on this account.</div>
    );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 min-w-0 flex h-11 items-center gap-2 rounded-full bg-sd-soft px-4">
          <Search size={17} className="text-sd-ink-faint shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="w-full min-w-0 bg-transparent text-base outline-none"
          />
        </div>
        <button
          onClick={() => navigate({ to: "/store/products/upload" })}
          aria-label="Upload products"
          className="oak-tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sd-soft text-sd-ink oak-motion-control active:scale-90"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={() => setCreateTypeOpen(true)}
          aria-label="Add product"
          className="oak-tap grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sd-ink text-sd-bg oak-motion-control active:scale-90"
        >
          <Plus size={18} />
        </button>
      </div>

      {createTypeOpen && (
        <CreateProductTypeModal
          onClose={() => setCreateTypeOpen(false)}
          onSelect={(kind) => {
            setCreateTypeOpen(false);
            navigate({ to: "/store/products/new", search: { kind } });
          }}
        />
      )}

      <div className="flex items-center gap-5 mb-6 border-b border-sd-line text-[14px] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`oak-tap shrink-0 pb-3 -mb-px border-b-2 font-medium transition-colors duration-200 ${activeTab === tab ? "border-sd-ink font-semibold text-sd-ink" : "border-transparent text-sd-ink-faint"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div className="text-[14px] text-sd-ink-faint text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        activeTab === "All" && !search.trim() ? (
          // Genuinely nothing listed yet (not just this tab/search coming up
          // empty) — the two ways to actually get a product on here shouldn't
          // require already knowing the header icons exist.
          <div className="flex flex-col items-center gap-3 py-12 animate-in fade-in duration-300">
            <p className="text-[15px] text-sd-ink-faint mb-2">No products yet.</p>
            <button
              type="button"
              onClick={() => setCreateTypeOpen(true)}
              className="oak-tap w-full max-w-xs h-12 rounded-full bg-sd-ink text-sd-bg text-[15px] font-semibold oak-motion-control active:scale-[0.98]"
            >
              List a product
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/store/products/upload" })}
              className="oak-tap w-full max-w-xs h-12 rounded-full border border-sd-line text-sd-ink text-[15px] font-semibold oak-motion-control active:scale-[0.98]"
            >
              Upload products
            </button>
          </div>
        ) : (
          <div className="text-[14px] text-sd-ink-faint text-center py-12 animate-in fade-in duration-300">
            No products match.
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
          {products.map((p) => (
            <ProductListRow
              key={p.id}
              product={p}
              selectMode={selectMode}
              selected={selectedIds.has(p.id)}
              onLongPress={() => toggleSelected(p.id)}
              onTap={() =>
                selectMode
                  ? toggleSelected(p.id)
                  : navigate({ to: "/store/products/$id", params: { id: p.id } })
              }
            />
          ))}
        </div>
      )}

      {/* Nothing to move on from until there's actually a product — showing
          Next against an empty list let a seller "finish" this step without
          ever listing anything. Once one exists, Next stops being the only
          option: most sellers arriving from the checklist have more than one
          item to add, so the primary action stays "keep going" and Next is
          the deliberate opt-out. */}
      {checklist && products.length > 0 && !selectMode && (
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setCreateTypeOpen(true)}
            className="oak-tap w-full h-12 bg-sd-ink text-sd-bg text-[15px] font-semibold rounded-full oak-motion-control active:scale-[0.98]"
          >
            Keep listing
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/store" })}
            className="oak-tap w-full h-12 border border-sd-line text-sd-ink text-[15px] font-semibold rounded-full oak-motion-control active:scale-[0.98]"
          >
            Next
          </button>
        </div>
      )}

      {selectMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-sd-surface border-t border-sd-line pb-[env(safe-area-inset-bottom)] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
          {deleteError && (
            <p className="px-4 pt-2 text-[13px] text-sd-danger-ink animate-in fade-in slide-in-from-top-1 duration-200">
              {deleteError}
            </p>
          )}
          <div className="px-3 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setDeleteError("");
              }}
              aria-label="Cancel selection"
              className="oak-tap grid h-11 w-11 place-items-center rounded-full oak-motion-control active:scale-90"
            >
              <X size={18} className="text-sd-ink-muted" />
            </button>
            <span className="text-[15px] font-medium text-sd-ink">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
              aria-label="Delete selected"
              className="oak-tap grid h-11 w-11 place-items-center rounded-full text-sd-danger-ink disabled:opacity-50 oak-motion-control active:scale-90"
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
              Delete {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
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

function ProductListRow({
  product: p,
  selectMode,
  selected,
  onLongPress,
  onTap,
}: {
  product: ProductRow;
  selectMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  onTap: () => void;
}) {
  const longPress = useLongPress(onLongPress, { onTap });
  const v = p.product_variants[0];
  const imported = p.source_platform && p.source_platform !== "manual";
  return (
    <button
      type="button"
      {...longPress}
      style={{ WebkitTouchCallout: "none" }}
      className="oak-tap w-full flex items-center gap-3 border border-sd-line rounded-2xl p-3.5 text-left select-none oak-motion-control active:scale-[0.99]"
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
      <img
        src={v?.main_image_url ?? "https://placehold.co/64x64"}
        className="w-14 h-14 rounded-xl object-cover bg-sd-soft shrink-0"
        alt=""
      />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.01em] truncate">
          {p.title ?? "Untitled"}
        </p>
        <p className="text-[13px] text-sd-ink-muted truncate">
          {v?.price != null ? `₦${v.price.toLocaleString()}` : "No price"} · {v?.stock_qty ?? 0} in
          stock
          {p.product_variants.length > 1 ? ` · ${p.product_variants.length} variants` : ""}
          {imported ? ` · via ${p.source_platform}` : ""}
        </p>
      </div>
      {!selectMode && (
        <span className="text-[12px] font-medium px-2.5 py-1.5 rounded-full bg-sd-soft text-sd-ink-muted capitalize shrink-0">
          {p.status}
        </span>
      )}
    </button>
  );
}
