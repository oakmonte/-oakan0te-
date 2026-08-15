import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X, Plus, Trash2, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/store/products/new")({
  component: NewProduct,
});

const TABS = ["Basic info", "Variants"] as const;

type VariantDraft = {
  localId: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQty: string;
  sku: string;
  material: string;
  mainImageUrl: string;
};

function emptyVariant(): VariantDraft {
  return {
    localId: crypto.randomUUID(),
    option1Name: "",
    option1Value: "",
    option2Name: "",
    option2Value: "",
    price: "",
    compareAtPrice: "",
    costPrice: "",
    stockQty: "",
    sku: "",
    material: "",
    mainImageUrl: "",
  };
}

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

// TODO: dev-only, matches store.products.tsx. Revert before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

function NewProduct() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Basic info");

  const [title, setTitle] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [descriptionShort, setDescriptionShort] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateVariant(localId: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.localId === localId ? { ...v, ...patch } : v)));
  }

  function removeVariant(localId: string) {
    setVariants((prev) => (prev.length === 1 ? prev : prev.filter((v) => v.localId !== localId)));
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      setTab("Basic info");
      return;
    }
    const missingPrice = variants.find((v) => !v.price.trim());
    if (missingPrice) {
      setError("Every variant needs a price");
      setTab("Variants");
      return;
    }

    setSaving(true);
    setError("");

    const { data: product, error: productErr } = await supabase
      .from("products")
      .insert({
        store_id: DEV_STORE_ID,
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

    const variantRows = variants.map((v) => ({
      product_id: product.id,
      option1_name: v.option1Name.trim() || null,
      option1_value: v.option1Value.trim() || null,
      option2_name: v.option2Name.trim() || null,
      option2_value: v.option2Value.trim() || null,
      price: Number(v.price),
      compare_at_price: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      cost_price: v.costPrice ? Number(v.costPrice) : null,
      stock_qty: v.stockQty ? Number(v.stockQty) : 0,
      sku: v.sku.trim() || null,
      material: v.material.trim() || null,
      main_image_url: v.mainImageUrl.trim() || null,
    }));

    const { error: variantErr } = await supabase.from("product_variants").insert(variantRows);

    if (variantErr) {
      setError(variantErr.message);
      setSaving(false);
      return;
    }

    navigate({ to: "/store/products" });
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/store/products" })} className="p-1 -ml-1">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-sm">New product</span>
        <button onClick={() => navigate({ to: "/store/products" })} className="p-1 -mr-1">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-gray-100 px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-3 text-sm -mb-px border-b-2 ${
              tab === t ? "border-black font-medium text-black" : "border-transparent text-gray-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 py-5">
        {tab === "Basic info" && (
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
                rows={3}
              />
            </Field>
            <div className="flex gap-2 mt-1">
              {(["draft", "active"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                    status === s ? "bg-black text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "Variants" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-400">
              Leave the option fields blank for a single-SKU product. Fill them in (e.g. Size: M) to
              add more variants.
            </p>
            {variants.map((v, i) => (
              <div
                key={v.localId}
                className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Variant {i + 1}</span>
                  {variants.length > 1 && (
                    <button onClick={() => removeVariant(v.localId)} className="text-gray-400">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Option 1 name">
                    <input
                      value={v.option1Name}
                      onChange={(e) => updateVariant(v.localId, { option1Name: e.target.value })}
                      className="input"
                      placeholder="e.g. Size"
                    />
                  </Field>
                  <Field label="Option 1 value">
                    <input
                      value={v.option1Value}
                      onChange={(e) => updateVariant(v.localId, { option1Value: e.target.value })}
                      className="input"
                      placeholder="e.g. M"
                    />
                  </Field>
                  <Field label="Option 2 name">
                    <input
                      value={v.option2Name}
                      onChange={(e) => updateVariant(v.localId, { option2Name: e.target.value })}
                      className="input"
                      placeholder="e.g. Color"
                    />
                  </Field>
                  <Field label="Option 2 value">
                    <input
                      value={v.option2Value}
                      onChange={(e) => updateVariant(v.localId, { option2Value: e.target.value })}
                      className="input"
                      placeholder="e.g. Black"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price *">
                    <input
                      type="number"
                      value={v.price}
                      onChange={(e) => updateVariant(v.localId, { price: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Compare-at price">
                    <input
                      type="number"
                      value={v.compareAtPrice}
                      onChange={(e) => updateVariant(v.localId, { compareAtPrice: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Cost price">
                    <input
                      type="number"
                      value={v.costPrice}
                      onChange={(e) => updateVariant(v.localId, { costPrice: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Stock qty">
                    <input
                      type="number"
                      value={v.stockQty}
                      onChange={(e) => updateVariant(v.localId, { stockQty: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="SKU">
                  <input
                    value={v.sku}
                    onChange={(e) => updateVariant(v.localId, { sku: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Material">
                  <input
                    value={v.material}
                    onChange={(e) => updateVariant(v.localId, { material: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Image URL">
                  <input
                    value={v.mainImageUrl}
                    onChange={(e) => updateVariant(v.localId, { mainImageUrl: e.target.value })}
                    className="input"
                    placeholder="Paste an image URL for now"
                  />
                </Field>
              </div>
            ))}

            <button
              onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
              className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
            >
              <Plus size={16} /> Add another variant
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save product"}
        </button>
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
