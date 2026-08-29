import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Upload } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { CreateProductTypeModal } from "@/components/product-form/CreateProductTypeModal";
import { useActiveStoreId } from "@/hooks/use-own-store";

export const Route = createFileRoute("/store/products")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: StoreProducts,
});

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

function StoreProducts() {
  const navigate = useNavigate();
  const { checklist } = Route.useSearch();
  const { storeId, loading: storeLoading } = useActiveStoreId();

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);

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
    if (!error && data) setProducts(data as ProductRow[]);
    setListLoading(false);
  }, [storeId, activeTab, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (storeLoading) return <div className="px-4 py-8 text-sm text-gray-400">Loading…</div>;
  if (!storeId)
    return <div className="px-4 py-8 text-sm text-gray-400">No store found on this account.</div>;

  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
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
          className="p-2 rounded-lg bg-gray-100 text-gray-700 oak-motion-control active:scale-90"
        >
          <Upload size={16} />
        </button>
        <button
          onClick={() => setCreateTypeOpen(true)}
          aria-label="Add product"
          className="p-2 rounded-lg bg-black text-white oak-motion-control active:scale-90"
        >
          <Plus size={16} />
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

      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 text-sm overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 pb-2 -mb-px border-b-2 transition-colors duration-200 ${activeTab === tab ? "border-black font-medium text-black" : "border-transparent text-gray-400"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12 animate-in fade-in duration-300">
          No products yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
          {products.map((p) => {
            const v = p.product_variants[0];
            const imported = p.source_platform && p.source_platform !== "manual";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate({ to: "/store/products/$id", params: { id: p.id } })}
                className="w-full flex items-center gap-3 border border-gray-100 rounded-xl p-3 text-left oak-motion-control active:scale-[0.99]"
              >
                <img
                  src={v?.main_image_url ?? "https://placehold.co/64x64"}
                  className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title ?? "Untitled"}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {v?.price != null ? `₦${v.price.toLocaleString()}` : "No price"} ·{" "}
                    {v?.stock_qty ?? 0} in stock
                    {p.product_variants.length > 1
                      ? ` · ${p.product_variants.length} variants`
                      : ""}
                    {imported ? ` · via ${p.source_platform}` : ""}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-500 capitalize shrink-0">
                  {p.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {checklist && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate({ to: "/store" })}
            className="w-full bg-black text-white text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
