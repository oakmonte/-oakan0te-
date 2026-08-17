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
import { CategoryPicker } from "@/components/product-form/CategoryPicker";
import {
  VariantMatrixBuilder,
  VariantOption,
  VariantRow,
} from "@/components/product-form/VariantMatrixBuilder";

export const Route = createFileRoute("/store/products/new-variant")({
  component: NewVariantProduct,
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

type ExpandedSection = "description" | "price" | "type" | "vendor" | null;

function NewVariantProduct() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<"draft" | "active">("active");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [descriptionShort, setDescriptionShort] = useState("");
  const [categoryPath, setCategoryPath] = useState<CategoryNode[]>([]);

  // Base price fields shown at the top — used as a default reference; real
  // pricing lives per-row once options are defined.
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  const [options, setOptions] = useState<VariantOption[]>([{ name: "", values: [] }]);
  const [rows, setRows] = useState<VariantRow[]>([]);

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
    if (rows.length === 0) {
      setError("Add at least one option value to generate variants");
      return;
    }
    const missingPrice = rows.find((r) => !r.price.trim());
    if (missingPrice) {
      setError("Every variant needs a price");
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

    const variantRows = rows.map((r) => ({
      product_id: product.id,
      option1_name: options[0]?.name.trim() || null,
      option1_value: r.option1Value,
      option2_name: options[1]?.name.trim() || null,
      option2_value: r.option2Value,
      price: Number(r.price),
      compare_at_price: r.compareAtPrice ? Number(r.compareAtPrice) : null,
      cost_price: r.costPrice ? Number(r.costPrice) : null,
      stock_qty: r.stockQty ? Number(r.stockQty) : 0,
      sku: r.sku.trim() || null,
      main_image_url: r.mainImageUrl.trim() || mainImageUrl.trim() || null,
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
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {status === "active" ? "Active" : "Draft"}
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

      <VariantMatrixBuilder options={options} setOptions={setOptions} rows={rows} setRows={setRows} />

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