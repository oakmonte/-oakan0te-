import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { CreateProductTypeModal } from "@/components/product-form/CreateProductTypeModal";

export const Route = createFileRoute("/store/products")({
  component: StoreProducts,
});

const TABS = ["All", "Active", "Draft", "Archived"] as const;

// TODO: dev-only. Revert to session-scoped lookup (owner_id = user.id) before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

async function getDevStoreId(): Promise<{ id: string; bumpa_connected_at: string | null } | null> {
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id")
    .eq("id", DEV_STORE_ID)
    .single();
  if (storeErr || !store) {
    console.error("getDevStoreId failed:", storeErr?.message, storeErr?.code);
    return null;
  }

  const { data: creds } = await supabase
    .from("store_credentials")
    .select("bumpa_connected_at")
    .eq("store_id", store.id)
    .maybeSingle();

  return { id: store.id, bumpa_connected_at: creds?.bumpa_connected_at ?? null };
}

type ProductRow = {
  id: string;
  title: string | null;
  status: string;
  product_type: string | null;
  product_variants: {
    price: number | null;
    stock_qty: number | null;
    main_image_url: string | null;
  }[];
};

function StoreProducts() {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDevStoreId().then((store) => {
      if (cancelled) return;
      if (store) setStoreId(store.id);
      setStoreLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setListLoading(true);
    let query = supabase
      .from("products")
      .select("id, title, status, product_type, product_variants(price, stock_qty, main_image_url)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (activeTab !== "All") query = query.eq("status", activeTab.toLowerCase());
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
    return (
      <div className="px-4 py-8 text-sm text-gray-400">
        No store found yet — create one in Supabase to test against.
      </div>
    );

  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="bg-transparent text-base flex-1 outline-none"
          />
        </div>
        <button
          onClick={() => navigate({ to: "/store/products/new" })}
          className="p-2 rounded-lg bg-black text-white oak-motion-control active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 -mb-px border-b-2 transition-colors duration-200 ${activeTab === tab ? "border-black font-medium text-black" : "border-transparent text-gray-400"}`}
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
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border border-gray-100 rounded-xl p-3"
              >
                <img
                  src={v?.main_image_url ?? "https://placehold.co/64x64"}
                  className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title ?? "Untitled"}</p>
                  <p className="text-xs text-gray-500">
                    {v?.price != null ? `₦${v.price.toLocaleString()}` : "No price"} ·{" "}
                    {v?.stock_qty ?? 0} in stock
                    {p.product_variants.length > 1
                      ? ` · ${p.product_variants.length} variants`
                      : ""}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-500 capitalize">
                  {p.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
