import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Search, Store, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useOwnStores } from "@/hooks/use-own-store";
import type { TaggedProduct } from "@/components/feed/PostFeed";
import {
  FAKE_STORES,
  STORE_FILTERS,
  type FakeStore,
  type StoreFilterKey,
} from "@/components/feed/fake-collab-stores";

/** "Link products" for the owner of a post: every product they have listed,
 *  with the ones already on this post ticked. Writes straight to
 *  `post_product_tags`, the same table the publish flow's product tagger
 *  writes — this is that step, reachable again after the fact, so a post can
 *  pick up products that didn't exist when it went out.
 *
 *  A linked product is what makes the post shoppable: it's what draws the
 *  product chips under the caption and what a viewer's Listed items tab reads.
 *
 *  Three screens behind one sheet, because they're one task:
 *   - `mine`         your own products, searchable and filterable by status
 *   - `stores`       a directory of other stores to link from
 *   - `store`        one of those stores' products
 *
 *  The last two are UI ONLY. Cross-store linking needs a collaborator
 *  relationship (approved by the store, or a request sent to it) that has no
 *  table yet, and it's deliberately out of scope for the first public version
 *  — that release is about uploading and creating. The screens are built now
 *  so the collaborators page has something concrete to hang off; every control
 *  on them is inert on purpose, and the stores themselves are placeholder data
 *  (see fake-collab-stores.ts). */
type View = "mine" | "stores" | "store";

type OwnProduct = TaggedProduct & { status: string };

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
] as const;

type StatusFilterKey = (typeof STATUS_FILTERS)[number]["key"];

export function LinkProductsSheet({
  open,
  onClose,
  postId,
  linked,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  linked: TaggedProduct[];
  onChange: (next: TaggedProduct[]) => void;
}) {
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const { stores, loading: storesLoading } = useOwnStores();
  const [products, setProducts] = useState<OwnProduct[] | null>(null);
  // Ids mid-write, so a double tap can't fire two inserts for one product.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("mine");
  const [openStore, setOpenStore] = useState<FakeStore | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilterKey>("all");
  const [storeFilter, setStoreFilter] = useState<StoreFilterKey>("all");
  const linkedIds = new Set(linked.map((p) => p.id));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reopening lands back on your own products with a clean search — carrying
  // a stale query over from last time reads as the sheet having lost products.
  useEffect(() => {
    if (open) return;
    setView("mine");
    setOpenStore(null);
    setQuery("");
    setStatus("all");
    setStoreFilter("all");
  }, [open]);

  useEffect(() => {
    if (!open || storesLoading) return;
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    // Every status, filtered on the client: the filter chips need drafts in
    // hand, and a seller's catalogue is small enough that refetching per chip
    // would only add latency.
    supabase
      .from("products")
      .select("id, title, status, product_variants(price, main_image_url)")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("LinkProductsSheet: failed to load products", error);
          setProducts([]);
          return;
        }
        setProducts(
          (data ?? []).map((p) => ({
            id: p.id,
            title: p.title ?? "Untitled",
            status: p.status,
            price: p.product_variants[0]?.price ?? null,
            image: p.product_variants[0]?.main_image_url ?? null,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, stores, storesLoading]);

  const visibleProducts = useMemo(() => {
    if (!products) return null;
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (q === "" || p.title.toLowerCase().includes(q)),
    );
  }, [products, query, status]);

  const visibleStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAKE_STORES.filter(
      (s) =>
        (storeFilter === "all" || s.relation === storeFilter) &&
        (q === "" ||
          s.brand_name.toLowerCase().includes(q) ||
          s.store_username.toLowerCase().includes(q)),
    );
  }, [query, storeFilter]);

  async function toggle(product: OwnProduct) {
    if (busy.has(product.id)) return;
    const wasLinked = linkedIds.has(product.id);
    // Optimistic: the tick and the chips under the caption both move now, and
    // roll back together if the write fails.
    const next = wasLinked
      ? linked.filter((p) => p.id !== product.id)
      : [
          ...linked,
          { id: product.id, title: product.title, price: product.price, image: product.image },
        ];
    onChange(next);
    setBusy((s) => new Set(s).add(product.id));
    try {
      const { error } = wasLinked
        ? await supabase
            .from("post_product_tags")
            .delete()
            .eq("post_id", postId)
            .eq("product_id", product.id)
        : await supabase.from("post_product_tags").insert({
            post_id: postId,
            product_id: product.id,
          });
      if (error) throw error;
    } catch (err) {
      console.error("LinkProductsSheet: link toggle failed", err);
      onChange(linked);
    } finally {
      setBusy((s) => {
        const copy = new Set(s);
        copy.delete(product.id);
        return copy;
      });
    }
  }

  function goBack() {
    setQuery("");
    if (view === "store") {
      setView("stores");
      setOpenStore(null);
    } else {
      setView("mine");
    }
  }

  const title = view === "mine" ? "Link products" : view === "stores" ? "Other stores" : "";

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative flex flex-col rounded-t-[14px] bg-[#1c1c1e] text-white"
            style={{ height: "78vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 460, damping: 44 }}
            drag="y"
            // Drag ONLY from the handle. With the default listener the whole
            // sheet is a drag surface, so every attempt to scroll the product
            // list dragged the sheet instead of scrolling — fine when the list
            // was one empty state, fatal now that it's a real list.
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="flex justify-center pt-2 pb-1"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className="h-1 w-9 rounded-full bg-white/25" />
            </div>

            <div className="relative flex items-center justify-center px-4 pb-3">
              {view !== "mine" && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Back"
                  className="absolute left-3 text-white active:scale-90"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <span className="max-w-[60%] truncate text-[14px] font-semibold">
                {view === "store" ? openStore?.brand_name : title}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 text-white active:scale-90"
              >
                <X size={22} />
              </button>
            </div>

            {/* Search + the door to other stores. One row, because the store
                button is a peer of search, not a filter: it changes what
                you're searching, not how the results are narrowed. */}
            {view !== "store" && (
              <div className="flex items-center gap-2 px-4 pb-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-white/[0.08] px-3 py-2">
                  <Search size={15} className="shrink-0 text-white/40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={view === "mine" ? "Search products" : "Search stores"}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/35"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="shrink-0 text-white/40 active:scale-90"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {view === "mine" && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setView("stores");
                    }}
                    aria-label="Browse other stores"
                    className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white/[0.08] active:scale-90"
                  >
                    <Store size={17} />
                  </button>
                )}
              </div>
            )}

            {view !== "store" && (
              <div
                className="flex gap-2 overflow-x-auto px-4 pb-3"
                style={{ scrollbarWidth: "none" }}
              >
                {view === "mine"
                  ? STATUS_FILTERS.map((f) => (
                      <FilterChip
                        key={f.key}
                        label={f.label}
                        active={status === f.key}
                        onClick={() => setStatus(f.key)}
                      />
                    ))
                  : STORE_FILTERS.map((f) => (
                      <FilterChip
                        key={f.key}
                        label={f.label}
                        active={storeFilter === f.key}
                        onClick={() => setStoreFilter(f.key)}
                      />
                    ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {view === "mine" ? (
                <OwnProductList
                  products={visibleProducts}
                  loading={products === null || storesLoading}
                  hasAnyProducts={(products?.length ?? 0) > 0}
                  hasStore={stores.length > 0}
                  linkedIds={linkedIds}
                  onToggle={(p) => void toggle(p)}
                  onEmptyAction={() => {
                    onClose();
                    navigate({ to: stores.length === 0 ? "/store" : "/store/products/new" });
                  }}
                />
              ) : view === "stores" ? (
                <StoreList
                  stores={visibleStores}
                  onOpen={(s) => {
                    setQuery("");
                    setOpenStore(s);
                    setView("store");
                  }}
                />
              ) : (
                openStore && <StoreProducts store={openStore} />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-white text-black" : "bg-white/[0.08] text-white/60"
      }`}
    >
      {label}
    </button>
  );
}

function OwnProductList({
  products,
  loading,
  hasAnyProducts,
  hasStore,
  linkedIds,
  onToggle,
  onEmptyAction,
}: {
  products: OwnProduct[] | null;
  loading: boolean;
  hasAnyProducts: boolean;
  hasStore: boolean;
  linkedIds: Set<string>;
  onToggle: (p: OwnProduct) => void;
  onEmptyAction: () => void;
}) {
  if (loading || !products) {
    return (
      <div className="flex flex-col gap-2 pt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[62px] animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  // "Nothing matched your filter" and "you have no products" are different
  // problems with different fixes — offering "List a product" to someone whose
  // search just didn't match would be nonsense.
  if (products.length === 0 && hasAnyProducts) {
    return <p className="pt-12 text-center text-[13px] text-white/40">No products match that.</p>;
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="max-w-[240px] text-[13px] text-white/50">
          {hasStore
            ? "You have no listed products to link yet."
            : "Set up your store before you can link products to a post."}
        </p>
        <button
          type="button"
          onClick={onEmptyAction}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black active:scale-95"
        >
          {hasStore ? "List a product" : "Set up store"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {products.map((p) => {
        const isLinked = linkedIds.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p)}
            aria-pressed={isLinked}
            className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
          >
            <img
              src={p.image ?? "https://placehold.co/48x48"}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg bg-white/10 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{p.title}</p>
              <p className="text-[12px] text-white/45">
                {p.price != null ? `₦${p.price.toLocaleString()}` : "No price"}
                {p.status !== "active" && ` · ${p.status}`}
              </p>
            </div>
            <span
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                isLinked ? "border-white bg-white text-black" : "border-white/35"
              }`}
            >
              {isLinked && <Check size={13} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StoreList({ stores, onOpen }: { stores: FakeStore[]; onOpen: (s: FakeStore) => void }) {
  if (stores.length === 0) {
    return <p className="pt-12 text-center text-[13px] text-white/40">No stores match that.</p>;
  }

  return (
    <div className="flex flex-col">
      {stores.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(s)}
          className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
        >
          <img
            src={s.avatar}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full bg-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{s.brand_name}</p>
            <p className="truncate text-[12px] text-white/45">
              @{s.store_username} · {s.productCount} items
            </p>
          </div>
          <RelationPill relation={s.relation} />
        </button>
      ))}
    </div>
  );
}

/** How a store stands toward you. Approved means the real version would let
 *  you link immediately; anything else would have to raise a request first. */
function RelationPill({ relation }: { relation: FakeStore["relation"] }) {
  if (relation === "approved") {
    return (
      <span className="shrink-0 rounded-full bg-white/[0.12] px-2.5 py-1 text-[11px] font-medium text-white/80">
        Approved
      </span>
    );
  }
  if (relation === "pending") {
    return (
      <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/45">
        Pending
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-medium text-white/70">
      Request
    </span>
  );
}

function StoreProducts({ store }: { store: FakeStore }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 pb-3 pt-1">
        <img
          src={store.avatar}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full bg-white/10 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{store.brand_name}</p>
          <p className="truncate text-[12px] text-white/45">
            @{store.store_username} · {store.category} · {store.followers} followers
          </p>
        </div>
        <RelationPill relation={store.relation} />
      </div>

      {/* Says plainly why nothing here does anything, rather than leaving
          taps to fail silently. */}
      <p className="mb-3 rounded-[10px] bg-white/[0.05] px-3 py-2.5 text-[12px] leading-relaxed text-white/45">
        {store.relation === "approved"
          ? "You're an approved collaborator. Linking another store's products isn't switched on yet — it lands with the collaborators page."
          : store.relation === "pending"
            ? "Your collaborator request is with this store. You'll be able to link their products once they approve it."
            : "You'd need this store to approve you as a collaborator before linking their products."}
      </p>

      {store.products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5 opacity-60">
          <img
            src={p.image}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg bg-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{p.title}</p>
            <p className="text-[12px] text-white/45">₦{p.price.toLocaleString()}</p>
          </div>
          <span
            aria-hidden
            className="h-[22px] w-[22px] shrink-0 rounded-full border border-white/20"
          />
        </div>
      ))}
    </div>
  );
}
