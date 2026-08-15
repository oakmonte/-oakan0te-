import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  ImageIcon,
  Truck,
  Package,
  Store as StoreIcon,
  Tag,
  Hash,
  Search,
  Minus,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/store/products/new")({
  component: NewProduct,
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

type StatusSheet = "status" | null;
type ExpandedSection = "description" | "price" | "options" | "type" | "vendor" | null;

function NewProduct() {
  const navigate = useNavigate();

  // Basic info
  const [status, setStatus] = useState<"draft" | "active">("active");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [descriptionShort, setDescriptionShort] = useState("");

  // Pricing
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  // Variants (single default variant for now — matches current DB shape)
  const [option1Name, setOption1Name] = useState("");
  const [option1Value, setOption1Value] = useState("");
  const [option2Name, setOption2Name] = useState("");
  const [option2Value, setOption2Value] = useState("");

  // Inventory
  const [stockQty, setStockQty] = useState(0);

  // Org-ish fields
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");

  const [statusSheet, setStatusSheet] = useState<StatusSheet>(null);
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
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
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

      {/* Product status */}
      <button
        onClick={() => setStatusSheet("status")}
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
          <ChevronRight size={16} className="text-gray-300" />
        </span>
      </button>

      {/* Media */}
      <div className="px-4 py-5 border-b-8 border-gray-50">
        <p className="text-[15px] font-semibold text-gray-900 mb-4">Media</p>
        <button
          onClick={() => toggle("price" === expanded ? null : "options")}
          className="w-full flex flex-col items-center gap-2"
          type="button"
        >
          <div
            className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {mainImageUrl ? (
              <img src={mainImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={28} className="text-gray-300" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-900">Add images</span>
        </button>
        <input
          value={mainImageUrl}
          onChange={(e) => setMainImageUrl(e.target.value)}
          placeholder="Paste an image URL for now"
          className="mt-3 w-full text-sm text-center text-gray-500 outline-none placeholder:text-gray-400"
        />
      </div>

      {/* Title + description + price */}
      <div className="px-4 py-4 border-b-8 border-gray-50">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
          className="w-full text-2xl text-gray-900 placeholder:text-gray-300 outline-none pb-3 border-b border-gray-100"
        />

        <button
          onClick={() => toggle("description")}
          className="w-full flex items-center justify-between py-4 border-b border-gray-100"
        >
          <span className="flex items-center gap-3 text-[15px] text-gray-900">
            <Plus size={18} className="text-gray-400" />
            {descriptionShort ? "Description" : "Add description"}
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        {expanded === "description" && (
          <textarea
            value={descriptionShort}
            onChange={(e) => setDescriptionShort(e.target.value)}
            placeholder="Short description"
            rows={3}
            autoFocus
            className="w-full text-sm outline-none py-3 text-gray-700 placeholder:text-gray-400"
          />
        )}

        <button
          onClick={() => toggle("price")}
          className="w-full flex items-center justify-between py-4"
        >
          <span className="text-[15px] text-gray-500">
            {compareAtPrice && (
              <span className="line-through mr-2 text-gray-300">
                ₦{Number(compareAtPrice).toLocaleString()}
              </span>
            )}
            <span className="text-2xl text-gray-900 font-medium">
              ₦{price ? Number(price).toLocaleString() : "0.00"}
            </span>
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        {expanded === "price" && (
          <div className="grid grid-cols-3 gap-3 pb-3">
            <PriceField label="Price *" value={price} onChange={setPrice} />
            <PriceField label="Compare-at" value={compareAtPrice} onChange={setCompareAtPrice} />
            <PriceField label="Cost" value={costPrice} onChange={setCostPrice} />
          </div>
        )}
      </div>

      {/* Publishing (static for now) */}
      <div className="px-4 py-4 border-b-8 border-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[15px] font-semibold text-gray-900">Publishing</span>
          <span className="text-sm text-blue-600 font-medium">Edit</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">2 channels</p>
        <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <StoreIcon size={16} className="text-gray-400" />
          Online Store, Point of Sale
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Tag size={16} className="text-gray-400" />
          No catalogs
        </div>
      </div>

      {/* Variants */}
      <div className="border-b-8 border-gray-50">
        <p className="px-4 pt-4 text-[15px] font-semibold text-gray-900">Variants</p>
        <button
          onClick={() => toggle("options")}
          className="w-full flex items-center justify-between px-4 py-4"
        >
          <span className="flex items-center gap-3 text-[15px] text-gray-500">
            <Plus size={18} className="text-gray-400" />
            Add options (color, size, etc.)
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        {expanded === "options" && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <TextField
              label="Option 1 name"
              value={option1Name}
              onChange={setOption1Name}
              placeholder="Size"
            />
            <TextField
              label="Option 1 value"
              value={option1Value}
              onChange={setOption1Value}
              placeholder="M"
            />
            <TextField
              label="Option 2 name"
              value={option2Name}
              onChange={setOption2Name}
              placeholder="Color"
            />
            <TextField
              label="Option 2 value"
              value={option2Value}
              onChange={setOption2Value}
              placeholder="Black"
            />
            <div className="col-span-2">
              <TextField label="Material" value={material} onChange={setMaterial} />
            </div>
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="px-4 py-4 border-b-8 border-gray-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-semibold text-gray-900">Inventory</span>
          <span className="text-sm text-blue-600 font-medium">Edit</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-900">Available</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStockQty((q) => Math.max(0, q - 1))}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
            >
              <Minus size={14} />
            </button>
            <span className="w-10 text-center text-[15px] font-medium bg-gray-100 rounded-full py-1">
              {stockQty}
            </span>
            <button
              onClick={() => setStockQty((q) => q + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Remaining rows */}
      <StubRow icon={<Truck size={18} />} label="Shipping" />
      <ExpandRow
        icon={<Package size={18} />}
        label="Type"
        value={productType}
        expanded={expanded === "type"}
        onToggle={() => toggle("type")}
      >
        <TextField
          label="Product type"
          value={productType}
          onChange={setProductType}
          placeholder="e.g. Hoodie"
        />
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

      {/* Status bottom sheet */}
      {statusSheet === "status" && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStatusSheet(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-4 pb-8">
            <p className="text-sm font-medium text-gray-500 mb-3">Product status</p>
            {(["active", "draft"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  setStatusSheet(null);
                }}
                className="w-full flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <span className="text-[15px] capitalize text-gray-900">{s}</span>
                {status === s && <span className="text-black">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StubRow({
  icon,
  label,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  isLast?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center justify-between px-4 py-4 ${
        isLast ? "" : "border-b-8 border-gray-50"
      }`}
      type="button"
    >
      <span className="flex items-center gap-3 text-[15px] text-gray-900">
        <span className="text-gray-400">{icon}</span>
        {label}
      </span>
      <ChevronRight size={16} className="text-gray-300" />
    </button>
  );
}

function ExpandRow({
  icon,
  label,
  value,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b-8 border-gray-50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4"
        type="button"
      >
        <span className="flex flex-col items-start">
          <span className="flex items-center gap-3 text-[15px] text-gray-900">
            <span className="text-gray-400">{icon}</span>
            {label}
          </span>
          {value && <span className="text-xs text-gray-400 ml-7">{value}</span>}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none"
      />
    </label>
  );
}
