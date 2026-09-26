import { useEffect, useState } from "react";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

type ProductRow = {
  id: string;
  title: string | null;
  main_image_url: string | null;
};

// Read-only look inside one collection's products, opened from CollectionsSheet
// while a seller is mid-creating a *different* product. Deliberately has no
// "Add products" affordance and no way to remove one -- managing a
// collection's contents is collection-detail-page business
// (store.collections_.$id.tsx); this sheet exists only so "which products
// are already in here?" doesn't require abandoning the product form to find
// out.
export function CollectionProductsViewSheet({
  collectionId,
  collectionTitle,
  onClose,
}: {
  collectionId: string;
  collectionTitle: string;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<ProductRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: links } = await supabase
        .from("product_collections")
        .select("product_id")
        .eq("collection_id", collectionId);
      const productIds = (links ?? []).map((l) => l.product_id);
      if (productIds.length === 0) {
        if (!cancelled) setProducts([]);
        return;
      }
      const { data: rows } = await supabase
        .from("products")
        .select("id, title, product_variants(main_image_url)")
        .in("id", productIds);
      if (cancelled) return;
      setProducts(
        (rows ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          main_image_url: r.product_variants?.[0]?.main_image_url ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-sm text-gray-500 flex items-center gap-0.5 -ml-1"
          type="button"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2 truncate max-w-[50%]">
          {collectionTitle}
        </span>
        <span className="w-10" />
      </div>

      {products === null ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12">
          No products in this collection yet.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3 animate-in fade-in duration-300">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-full flex items-center gap-3 border border-gray-100 rounded-xl p-3"
            >
              <span className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {p.main_image_url ? (
                  <img src={p.main_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-gray-300" />
                )}
              </span>
              <span className="text-sm font-medium truncate">{p.title ?? "Untitled"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
