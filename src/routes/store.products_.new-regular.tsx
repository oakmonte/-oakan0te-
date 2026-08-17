import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Truck, Package, Store as StoreIcon, Tag, Hash, Search } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CategoryNode } from "@/lib/categories";
import { StubRow, ExpandRow, TextField } from "@/components/product-form/ui";
import { StatusSheet } from "@/components/product-form/StatusSheet";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DetailsSection } from "@/components/product-form/DetailsSection";
import { PublishingSection } from "@/components/product-form/PublishingSection";
import { VariantsSection } from "@/components/product-form/VariantsSection";
import { InventorySection } from "@/components/product-form/InventorySection";
import { CategoryPicker } from "@/components/product-form/CategoryPicker";

export const Route = createFileRoute("/store/products/new-regular")({
  component: NewRegularProduct,
});

// TODO: dev-only, matches store.products.tsx. Revert before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

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

type ExpandedSection = "description" | "price" | "options" | "type" | "vendor" | null;

function NewRegularProduct() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<"draft" | "active">("active");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [descriptionShort, setDescriptionShort] = useState("");
  const [categoryPath, setCategoryPath] = useState<CategoryNode[]>([]);

  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  const [option1Name, setOption1Name] = useState("");
  const [option1Value, setOption1Value] = useState("");
  const [option2Name, setOption2Name] = useState("");
  const [option2Value, setOption2Value] = useState("");
  const [material, setMaterial] = useState("");

  const [stockQty, setStockQty] = useState(0);
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");

  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedSection>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(section: ExpandedSection) {
    setExpanded((prev) => (prev === section ? null : section));
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!price.trim()) {
      setError("Price is required");
      setExpanded("price");
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
        product_type: productType.trim() || categoryPath.at(-1)?.name || null,
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
      option1_name: option1Name.trim() || null,
      option1_value: option1Value.trim() || null,
      option2_name: option2Name.trim() || null,
      option2_value: option2Value.trim() || null,
      price: Number(price),
      compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      stock_qty: stockQty,
      material: material.trim() || null,
      main_image_url: mainImageUrl.trim() || null,
    });

    if (variantErr) {
      setError(variantErr.message);
      setSaving(false);
      return;
    }

    navigate({ to: "/store/products" });
  }

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/store/products" })}
          className="text-sm text-gray-500 flex items-center gap-0.5 -ml-1"
        >
          <ChevronLeft size={18} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => setStatusSheetOpen(true)}
        className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-gray-50"
      >
        <span className="text-[15px] font-semibold text-gray-900">Product status</span>
        <span className="flex items-center gap-1">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {status === "active" ? "Active" : "Draft"}
          </span>
        </span>
      </button>

      <MediaSection mainImageUrl={mainImageUrl} onChange={setMainImageUrl} />

      <DetailsSection
        title={title}
        setTitle={setTitle}
        descriptionShort={descriptionShort}
        setDescriptionShort={setDescriptionShort}
        categoryPath={categoryPath}
        onOpenCategoryPicker={() => setCategoryPickerOpen(true)}
        price={price}
        setPrice={setPrice}
        compareAtPrice={compareAtPrice}
        setCompareAtPrice={setCompareAtPrice}
        costPrice={costPrice}
        setCostPrice={setCostPrice}
        expanded={expanded === "description" || expanded === "price" ? expanded : null}
        setExpanded={setExpanded}
      />

      <PublishingSection />

      <VariantsSection
        expanded={expanded === "options"}
        onToggle={() => toggle("options")}
        option1Name={option1Name}
        setOption1Name={setOption1Name}
        option1Value={option1Value}
        setOption1Value={setOption1Value}
        option2Name={option2Name}
        setOption2Name={setOption2Name}
        option2Value={option2Value}
        setOption2Value={setOption2Value}
        material={material}
        setMaterial={setMaterial}
      />

      <InventorySection stockQty={stockQty} setStockQty={setStockQty} />

      <StubRow icon={<Truck size={18} />} label="Shipping" />
      <ExpandRow
        icon={<Package size={18} />}
        label="Type"
        value={productType}
        expanded={expanded === "type"}
        onToggle={() => toggle("type")}
      >
        <TextField label="Product type" value={productType} onChange={setProductType} placeholder="e.g. Hoodie" />
      </ExpandRow>
      <ExpandRow
        icon={<StoreIcon size={18} />}
        label="Vendor"
        value={brand || "My Store"}
        expanded={expanded === "vendor"}
        onToggle={() => toggle("vendor")}
      >
        <TextField label="Brand" value={brand} onChange={setBrand} />
      </ExpandRow>
      <StubRow icon={<Tag size={18} />} label="Collections" />
      <StubRow icon={<Hash size={18} />} label="Tags" />
      <StubRow icon={<Search size={18} />} label="SEO" isLast />

      {statusSheetOpen && (
        <StatusSheet
          status={status}
          onSelect={(s) => {
            setStatus(s);
            setStatusSheetOpen(false);
          }}
          onClose={() => setStatusSheetOpen(false)}
        />
      )}

      {categoryPickerOpen && (
        <CategoryPicker
          onSelect={(path) => {
            setCategoryPath(path);
            setCategoryPickerOpen(false);
          }}
          onClose={() => setCategoryPickerOpen(false)}
        />
      )}
    </div>
  );
}