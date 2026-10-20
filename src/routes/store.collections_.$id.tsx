import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useStoreHeader } from "@/hooks/use-store-header";
import { deleteCollection } from "@/lib/collections";
import {
  hasPendingProductDraft,
  peekPendingProductDraftId,
  setPendingNewCollectionId,
} from "@/lib/product-draft-handoff";
import { pathTarget } from "@/lib/nav-hierarchy";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import { CollectionActionsSheet } from "@/components/product-form/CollectionActionsSheet";
import { StatusPicker } from "@/components/product-form/StatusPicker";
import { MediaSection } from "@/components/product-form/MediaSection";

export const Route = createFileRoute("/store/collections_/$id")({
  component: CollectionDetail,
});

type CollectionInfo = {
  id: string;
  title: string;
  image_url: string | null;
  additional_image_urls: string[] | null;
  status: string;
};

type ProductRow = {
  id: string;
  title: string | null;
  main_image_url: string | null;
};

function CollectionDetail() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { storeId } = useActiveStoreId();
  const { setRightAction } = useStoreHeader();

  const [collection, setCollection] = useState<CollectionInfo | null | undefined>(undefined); // undefined = loading, null = not found
  // Opened from a product form's Collections sheet (a stashed draft is
  // waiting): back returns there with the draft intact, not to the list.
  const editingProductId = peekPendingProductDraftId();
  const returnTo = hasPendingProductDraft()
    ? editingProductId
      ? `/store/products/${editingProductId}`
      : "/store/products/new"
    : "/store/collections";
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState("");
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [productsSheetOpen, setProductsSheetOpen] = useState(false);
  // Deleting a collection is destructive (and can also delete its products) —
  // same "..." -> actions sheet -> explicit confirm pattern as the product
  // edit page, rather than a bare trash icon in this page's own header.
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [photosError, setPhotosError] = useState("");

  // Photos are edited right here, saved as they change -- this page has no
  // Save button. The first is the cover; the rest are the storefront tile's
  // slideshow. Collections used to get their photos only at creation, so an
  // existing one could never gain a second image.
  const photos = collection
    ? [collection.image_url, ...(collection.additional_image_urls ?? [])].filter(
        (u): u is string => !!u,
      )
    : [];
  const photosKey = photos.join("|");
  const savedPhotosKey = useRef<string | null>(null);
  useEffect(() => {
    if (!collection || !storeId) return;
    // The first load is what's saved already.
    if (savedPhotosKey.current === null) {
      savedPhotosKey.current = photosKey;
      return;
    }
    if (photosKey === savedPhotosKey.current) return;
    // A photo still uploading is a blob: preview; wait for its real URL
    // (MediaSection swaps it in), never save the preview.
    if (photos.some((u) => u.startsWith("blob:"))) return;
    const t = setTimeout(async () => {
      const [cover, ...rest] = photos;
      const { error } = await supabase
        .from("collections")
        .update({ image_url: cover ?? null, additional_image_urls: rest.length > 0 ? rest : null })
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) {
        setPhotosError("Couldn't save the photos — try again.");
        return;
      }
      savedPhotosKey.current = photosKey;
      setPhotosError("");
    }, 400);
    return () => clearTimeout(t);
    // photos is derived from photosKey; the key is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey, collection?.id, storeId, id]);

  // Save: everything here already saves as it changes, but a page without a
  // Save button left sellers unsure anything had stuck. This stores what's
  // still pending (a name being typed, photos inside their 400ms wait) and
  // goes back.
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (!collection || !storeId || saving) return;
    if (photos.some((u) => u.startsWith("blob:"))) {
      setPhotosError("A photo is still uploading — give it a moment, then save.");
      return;
    }
    setSaving(true);
    await saveTitle();
    if (photosKey !== savedPhotosKey.current) {
      const [cover, ...rest] = photos;
      const { error } = await supabase
        .from("collections")
        .update({ image_url: cover ?? null, additional_image_urls: rest.length > 0 ? rest : null })
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) {
        setSaving(false);
        setPhotosError("Couldn't save the photos — try again.");
        return;
      }
      savedPhotosKey.current = photosKey;
    }
    navigate({ to: returnTo });
  }

  // Saved on tap, like Add products below.
  // Optimistic, rolled back if the write fails.
  async function handleStatusChange(next: "draft" | "active") {
    if (!collection || !storeId || collection.status === next) return;
    const prev = collection.status;
    setCollection({ ...collection, status: next });
    setStatusError("");
    const { error } = await supabase
      .from("collections")
      .update({ status: next })
      .eq("id", id)
      .eq("store_id", storeId);
    if (error) {
      setCollection((c) => (c ? { ...c, status: prev } : c));
      setStatusError("Couldn't change the status — try again.");
    }
  }

  const fetchCollection = useCallback(async () => {
    const { data } = await supabase
      .from("collections")
      .select("id, title, image_url, additional_image_urls, status")
      .eq("id", id)
      .maybeSingle();
    setCollection(data ?? null);
  }, [id]);

  const fetchProducts = useCallback(async () => {
    const { data: links } = await supabase
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", id);
    const productIds = (links ?? []).map((l) => l.product_id);
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
  }, [id]);

  useEffect(() => {
    fetchCollection();
    fetchProducts();
  }, [fetchCollection, fetchProducts]);

  useEffect(() => {
    setRightAction(
      <button
        type="button"
        onClick={() => setActionsSheetOpen(true)}
        aria-label="Collection actions"
        className="p-1 -mr-1 text-sd-ink"
      >
        <MoreHorizontal size={20} />
      </button>,
    );
    return () => setRightAction(null);
  }, [setRightAction]);

  async function handleApplyProducts(nextIds: string[]) {
    const currentIds = new Set((products ?? []).map((p) => p.id));
    const nextSet = new Set(nextIds);

    const toAdd = nextIds.filter((pid) => !currentIds.has(pid));
    const toRemove = [...currentIds].filter((pid) => !nextSet.has(pid));

    if (toAdd.length > 0) {
      await supabase
        .from("product_collections")
        .insert(toAdd.map((product_id) => ({ product_id, collection_id: id })));
    }
    if (toRemove.length > 0) {
      await supabase
        .from("product_collections")
        .delete()
        .eq("collection_id", id)
        .in("product_id", toRemove);
    }

    setProductsSheetOpen(false);
    fetchProducts();
  }

  async function handleDelete(withProducts: boolean) {
    const { error } = await deleteCollection(id, withProducts);
    if (error) throw new Error(error);
    navigate({ to: returnTo });
  }

  // Saved when the field loses focus, like the rest of this page.
  async function saveTitle() {
    if (titleDraft === null || !collection || !storeId) return;
    const next = titleDraft.trim();
    setTitleDraft(null);
    if (!next || next === collection.title) return;
    const prev = collection.title;
    setCollection({ ...collection, title: next });
    setTitleError("");
    const { error } = await supabase
      .from("collections")
      .update({ title: next })
      .eq("id", id)
      .eq("store_id", storeId);
    if (error) {
      setCollection((c) => (c ? { ...c, title: prev } : c));
      setTitleError("Couldn't rename it, try again.");
    }
  }

  if (collection === undefined)
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (collection === null)
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Collection not found.</div>;

  return (
    <div className="min-h-dvh bg-sd-surface pb-10">
      <div className="sticky top-14 z-20 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <BackButton
          icon="chevron"
          size={18}
          label={returnTo === "/store/collections" ? "Collections" : "Back"}
          to={pathTarget(returnTo)}
          className="text-sm text-sd-ink-muted flex items-center gap-0.5 -ml-1"
        />
        <span className="font-semibold text-[15px] truncate max-w-[45%]">{collection.title}</span>
        <span className="w-6" />
      </div>

      {/* On a wide screen the photo card is a centred block rather than a
          full-width strip, the same as the product form. */}
      <div
        className={`mx-4 mt-4 overflow-hidden rounded-2xl border border-sd-ink/25 bg-sd-surface md:mx-auto md:w-full md:max-w-md ${
          collection.image_url ? "" : "md:h-[260px] md:flex md:flex-col md:justify-center"
        }`}
      >
        <MediaSection
          mainImageUrl={collection.image_url ?? ""}
          onChange={(url) => setCollection((c) => (c ? { ...c, image_url: url || null } : c))}
          additionalImageUrls={collection.additional_image_urls ?? []}
          onAdditionalChange={(urls) =>
            setCollection((c) => (c ? { ...c, additional_image_urls: urls } : c))
          }
          noDivider
        />
      </div>
      {photosError && <p className="mx-4 mt-2 text-sm text-sd-danger-ink">{photosError}</p>}

      {/* The name, in its own card like the new-collection form. Saved when
          the field loses focus (and by Save below). */}
      <div className="mx-4 mt-4 rounded-2xl border border-sd-ink/25 bg-sd-surface px-4 py-4">
        <label htmlFor="collection-name" className="text-xs font-medium text-sd-ink-muted">
          Collection name
        </label>
        <input
          id="collection-name"
          value={titleDraft ?? collection.title}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          maxLength={80}
          className="mt-1 w-full bg-transparent text-[22px] font-semibold leading-tight text-sd-ink outline-none"
        />
      </div>
      {titleError && <p className="mx-4 mt-2 text-sm text-sd-danger-ink">{titleError}</p>}

      <div className="px-4 pt-4">
        <StatusPicker
          label="Collection Status"
          value={collection.status === "draft" ? "draft" : "active"}
          onChange={handleStatusChange}
        />
        {statusError && <p className="mt-2 text-sm text-sd-danger-ink">{statusError}</p>}
        {collection.status === "draft" && (
          <p className="mt-2 text-[13px] text-sd-ink-faint">
            Inactive collections don't show on your storefront.
          </p>
        )}
      </div>

      {/* The products in it: a titled card, rows split by lines, with a compact
          Add button in its header instead of a full-width bar. */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-sd-ink/25 bg-sd-surface">
        <div className="flex items-center justify-between px-4 py-3.5">
          <p className="text-[15px] font-semibold text-sd-ink">
            Products
            {products && products.length > 0 && (
              <span className="ml-1.5 font-normal text-sd-ink-muted">{products.length}</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setProductsSheetOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-sd-ink/25 px-3.5 py-2 text-[13px] font-medium text-sd-ink oak-motion-control active:scale-[0.97]"
          >
            <Plus size={15} />
            Add products
          </button>
        </div>
        {products === null ? (
          <div className="border-t border-sd-line py-10 text-center text-sm text-sd-ink-faint">
            Loading…
          </div>
        ) : products.length === 0 ? (
          <div className="border-t border-sd-line py-10 text-center text-sm text-sd-ink-faint animate-in fade-in duration-300">
            No products in this collection yet.
          </div>
        ) : (
          <div className="divide-y divide-sd-line border-t border-sd-line animate-in fade-in duration-300">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate({ to: "/store/products/$id", params: { id: p.id } })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sd-soft"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sd-soft">
                  {p.main_image_url ? (
                    <img src={p.main_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon size={16} className="text-sd-ink-faint" />
                  )}
                </span>
                <span className="truncate text-sm font-medium">{p.title ?? "Untitled"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mx-auto block w-full md:max-w-sm bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-3.5 disabled:opacity-50 oak-motion-control active:scale-[0.98]"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {productsSheetOpen && storeId && (
        <ProductsSheet
          storeId={storeId}
          selectedIds={(products ?? []).map((p) => p.id)}
          onDone={handleApplyProducts}
          onClose={() => setProductsSheetOpen(false)}
          onCreateNew={() => {
            setPendingNewCollectionId(id);
            navigate({ to: "/store/products/new" });
          }}
        />
      )}

      {actionsSheetOpen && (
        <CollectionActionsSheet
          productCount={products?.length ?? 0}
          onClose={() => setActionsSheetOpen(false)}
          onDeleteOnly={() => handleDelete(false)}
          onDeleteWithProducts={() => handleDelete(true)}
        />
      )}
    </div>
  );
}
