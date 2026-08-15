import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, X, Link } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

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

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

function StoreProducts() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

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
            className="bg-transparent text-sm flex-1 outline-none"
          />
        </div>
        <Link to="/store/products/new" className="p-2 rounded-lg bg-black text-white">
          <Plus size={16} />
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 -mb-px border-b-2 ${activeTab === tab ? "border-black font-medium text-black" : "border-transparent text-gray-400"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div className="text-sm text-gray-400 text-center py-12">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12">No products yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
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

      {sheetOpen && (
        <CreateProductSheet
          storeId={storeId}
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}

function CreateProductSheet({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [descriptionShort, setDescriptionShort] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [material, setMaterial] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim() || !price.trim()) {
      setError("Title and price are required");
      return;
    }
    setSaving(true);
    setError("");

    const { data: product, error: productErr } = await supabase
      .from("products")
      .insert({
        store_id: storeId,
        handle: slugify(title),
        title: title.trim(),
        description_short: descriptionShort.trim() || null,
        product_type: productType.trim() || null,
        brand: brand.trim() || null,
        status,
        source_platform: "manual",
        is_complete: true,
      })
      .select("id")
      .single();

    if (productErr || !product) {
      setError(productErr?.message ?? "Failed to create product");
      setSaving(false);
      return;
    }

    const { error: variantErr } = await supabase.from("product_variants").insert({
      product_id: product.id,
      price: Number(price),
      compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      stock_qty: stockQty ? Number(stockQty) : 0,
      material: material.trim() || null,
      main_image_url: mainImageUrl.trim() || null,
    });

    if (variantErr) {
      setError(variantErr.message);
      setSaving(false);
      return;
    }

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">New product</h2>
          <button onClick={onClose} className="p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Field label="Title *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </Field>
          <Field label="Product type">
            <input
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="input"
              placeholder="e.g. Hoodie"
            />
          </Field>
          <Field label="Brand">
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input" />
          </Field>
          <Field label="Short description">
            <textarea
              value={descriptionShort}
              onChange={(e) => setDescriptionShort(e.target.value)}
              className="input"
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price *">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                className="input"
              />
            </Field>
            <Field label="Compare-at price">
              <input
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                type="number"
                className="input"
              />
            </Field>
            <Field label="Cost price">
              <input
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                type="number"
                className="input"
              />
            </Field>
            <Field label="Stock qty">
              <input
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                type="number"
                className="input"
              />
            </Field>
          </div>

          <Field label="Material">
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Image URL">
            <input
              value={mainImageUrl}
              onChange={(e) => setMainImageUrl(e.target.value)}
              className="input"
              placeholder="Paste an image URL for now"
            />
          </Field>

          <div className="flex gap-2">
            {(["draft", "active"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-lg text-sm capitalize ${status === s ? "bg-black text-white" : "bg-gray-100 text-gray-500"}`}
              >
                {s}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-black text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50 mt-2"
          >
            {saving ? "Saving..." : "Save product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
