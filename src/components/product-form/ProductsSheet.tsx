import { useEffect, useState } from "react";
import { X, Search, ImageIcon, Check, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

type ProductRow = {
  id: string;
  title: string | null;
  main_image_url: string | null;
};

// Picker for a store's *existing* products, used from inside a collection's
// detail page (and the new-collection form) — the reverse of
// CollectionsSheet.tsx (which picks collections from inside a product).
// Creating a brand-new product happens on its own route via onCreateNew, same
// split as CollectionsSheet's onCreateNew — omit it (new-collection form,
// which has no collection id yet to hand a new product back to) to hide the
// create-new entry points entirely.
export function ProductsSheet({
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
  onCreateNew?: () => void;
}) {
  const [products, setProducts] = useState<ProductRow[] | null>(null); // null = loading
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("products")
        .select("id, title, product_variants(main_image_url)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
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
  }, [storeId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = (products ?? []).filter((p) =>
    (p.title ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Products
        </span>
        {onCreateNew ? (
          <button
            onClick={onCreateNew}
            type="button"
            aria-label="Create product"
            className="p-1 -mr-1"
          >
            <Plus size={20} className="text-gray-900" />
          </button>
        ) : (
          <span className="w-6" />
        )}
      </div>

      {products !== null && products.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[15px] text-gray-400">No products yet</p>
          {onCreateNew && (
            <button
              type="button"
              onClick={onCreateNew}
              className="bg-black text-white text-sm font-medium rounded-full px-5 py-2.5"
            >
              Create product
            </button>
          )}
        </div>
      )}

      {products !== null && products.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter products"
                className="bg-transparent text-base flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${p.title ?? "Untitled"}`}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50"
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isSelected ? "bg-black border-black" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-white oak-motion-pop" />}
                  </span>
                  <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {p.main_image_url ? (
                      <img src={p.main_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-gray-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] text-gray-900 truncate">
                    {p.title ?? "Untitled"}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</p>
            )}
          </div>

          <div className="sticky bottom-0 bg-black text-white px-4 h-14 flex items-center justify-between shrink-0">
            <span className="text-sm">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => onDone([...selected])}
              className="text-sm font-medium bg-white/15 rounded-full px-4 py-2"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
