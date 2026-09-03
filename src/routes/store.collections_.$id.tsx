import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useStoreHeader } from "@/hooks/use-store-header";
import { deleteCollection } from "@/lib/collections";
import { setPendingNewCollectionId } from "@/lib/product-draft-handoff";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import { CollectionActionsSheet } from "@/components/product-form/CollectionActionsSheet";

export const Route = createFileRoute("/store/collections_/$id")({
  component: CollectionDetail,
});

type CollectionInfo = {
  id: string;
  title: string;
  image_url: string | null;
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
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [productsSheetOpen, setProductsSheetOpen] = useState(false);
  // Deleting a collection is destructive (and can also delete its products) —
  // same "..." -> actions sheet -> explicit confirm pattern as the product
  // edit page, rather than a bare trash icon in this page's own header.
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);

  const fetchCollection = useCallback(async () => {
    const { data } = await supabase
      .from("collections")
      .select("id, title, image_url")
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
        className="p-1 -mr-1 text-gray-900"
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
    navigate({ to: "/store/collections" });
  }

  if (collection === undefined)
    return <div className="px-4 py-8 text-sm text-gray-400">Loading…</div>;
  if (collection === null)
    return <div className="px-4 py-8 text-sm text-gray-400">Collection not found.</div>;

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-14 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/store/collections" })}
          className="text-sm text-gray-500 flex items-center gap-0.5 -ml-1"
          type="button"
        >
          <ChevronLeft size={18} />
          Collections
        </button>
        <span className="font-semibold text-[15px] truncate max-w-[45%]">{collection.title}</span>
        <span className="w-6" />
      </div>

      <div className="px-4 py-4 flex items-center gap-3 border-b-8 border-gray-50">
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
          {collection.image_url ? (
            <img src={collection.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-300" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900 truncate">{collection.title}</p>
          <p className="text-xs text-gray-500">
            {products?.length ?? 0} product{(products?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => setProductsSheetOpen(true)}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-900 oak-motion-control active:scale-[0.99]"
        >
          <Plus size={16} />
          Add products
        </button>
      </div>

      {products === null ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12 animate-in fade-in duration-300">
          No products in this collection yet.
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-3 animate-in fade-in duration-300">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ to: "/store/products/$id", params: { id: p.id } })}
              className="w-full flex items-center gap-3 border border-gray-100 rounded-xl p-3 text-left oak-motion-control active:scale-[0.99]"
            >
              <span className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {p.main_image_url ? (
                  <img src={p.main_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-gray-300" />
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
