import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Tag,
  Hash,
  ListChecks,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CategoryNode } from "@/lib/categories";
import { StubRow, ExpandRow, TextField } from "@/components/product-form/ui";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DetailsSection } from "@/components/product-form/DetailsSection";
import { DescriptionSheet } from "@/components/product-form/DescriptionSheet";
import { CollectionsSheet } from "@/components/product-form/CollectionsSheet";
import { PricingSheet } from "@/components/product-form/PricingSheet";
import { CategoryPicker } from "@/components/product-form/CategoryPicker";
import { ProductTypeSwitchSheet } from "@/components/product-form/ProductTypeSwitchSheet";
import {
  VariantMatrixBuilder,
  VariantOption,
  VariantRow,
} from "@/components/product-form/VariantMatrixBuilder";
import {
  stashProductDraft,
  takeProductDraft,
  takePendingNewCollectionId,
} from "@/lib/product-draft-handoff";

export const Route = createFileRoute("/store/products_/new")({
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

type ProductKind = "regular" | "variant";
type ExpandedSection = "material" | null;

function NewProduct() {
  const navigate = useNavigate();

  // Restoring a draft stashed before a side-trip to create a collection — see
  // handleCreateCollection below. Read once via lazy initializers so every
  // field seeds correctly on the very first render (no restore flash).
  const [initialDraft] = useState(() => takeProductDraft());
  const [initialNewCollectionId] = useState(() => takePendingNewCollectionId());

  const [kind, setKind] = useState<ProductKind>(initialDraft?.kind ?? "variant");
  const [status, setStatus] = useState<"draft" | "active">(initialDraft?.status ?? "draft");
  const [mainImageUrl, setMainImageUrl] = useState(initialDraft?.mainImageUrl ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [descriptionShort, setDescriptionShort] = useState(initialDraft?.descriptionShort ?? "");
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [categoryPath, setCategoryPath] = useState<CategoryNode[]>(
    initialDraft?.categoryPath ?? [],
  );

  // Regular-mode state
  const [price, setPrice] = useState(initialDraft?.price ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(initialDraft?.compareAtPrice ?? "");
  const [costPrice, setCostPrice] = useState(initialDraft?.costPrice ?? "");
  const [stockQty, setStockQty] = useState(initialDraft?.stockQty ?? 0);
  const [material, setMaterial] = useState(initialDraft?.material ?? "");

  // Variant-mode state
  const [options, setOptions] = useState<VariantOption[]>(initialDraft?.options ?? []);
  const [rows, setRows] = useState<VariantRow[]>(initialDraft?.rows ?? []);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [typeSwitchOpen, setTypeSwitchOpen] = useState(false);
  const [descriptionSheetOpen, setDescriptionSheetOpen] = useState(false);
  const [collectionsSheetOpen, setCollectionsSheetOpen] = useState(false);
  const [collectionIds, setCollectionIds] = useState<string[]>(() => {
    const base = initialDraft?.collectionIds ?? [];
    if (initialNewCollectionId && !base.includes(initialNewCollectionId)) {
      return [...base, initialNewCollectionId];
    }
    return base;
  });
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleCreateCollection() {
    stashProductDraft({
      kind,
      status,
      mainImageUrl,
      title,
      descriptionShort,
      categoryPath,
      price,
      compareAtPrice,
      costPrice,
      stockQty,
      material,
      options,
      rows,
      collectionIds,
    });
    navigate({ to: "/store/collections/new" });
  }

  // Sellers can uncheck combinations they don't stock — only these get written.
  const selectedRows = rows.filter((r) => r.selected);

  function toggle(section: ExpandedSection) {
    setExpanded((prev) => (prev === section ? null : section));
  }

  function handleTypeSwitch(next: ProductKind) {
    setTypeSwitchOpen(false);
    setKind(next);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (kind === "regular") {
      if (!price.trim()) {
        setError("Price is required");
        setPriceSheetOpen(true);
        return;
      }
    } else {
      if (rows.length === 0) {
        setError("Add at least one option value to generate variants");
        return;
      }
      if (selectedRows.length === 0) {
        setError("Select at least one variant combination");
        return;
      }
      const missingPrice = selectedRows.find((r) => !r.price.trim());
      if (missingPrice) {
        setError("Every selected variant needs a price");
        return;
      }
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
        product_type: categoryPath.at(-1)?.name || null,
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

    if (kind === "regular") {
      const { error: variantErr } = await supabase.from("product_variants").insert({
        product_id: product.id,
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
    } else {
      const usableOptions = options.filter((o) => o.name.trim() && o.values.length > 0);

      // Ids are minted client-side so every row can be linked without a
      // round-trip, and without relying on insert order coming back intact.
      const optionIds = usableOptions.map(() => crypto.randomUUID());
      const valueIds = new Map<string, string>(); // `${optionIndex}|${value}` -> uuid

      const optionsPayload = usableOptions.map((o, i) => ({
        id: optionIds[i],
        product_id: product.id,
        name: o.name.trim(),
        position: i,
      }));

      const valuesPayload = usableOptions.flatMap((o, oi) =>
        o.values.map((v, vi) => {
          const id = crypto.randomUUID();
          valueIds.set(`${oi}|${v}`, id);
          return { id, option_id: optionIds[oi], value: v, position: vi };
        }),
      );

      const variantsPayload = selectedRows.map((r) => ({
        id: crypto.randomUUID(),
        product_id: product.id,
        // The flat columns stay in sync until the contract migration drops
        // them, so anything still reading option1_*/option2_* keeps working.
        option1_name: r.options[0]?.name ?? null,
        option1_value: r.options[0]?.value ?? null,
        option2_name: r.options[1]?.name ?? null,
        option2_value: r.options[1]?.value ?? null,
        option3_name: r.options[2]?.name ?? null,
        option3_value: r.options[2]?.value ?? null,
        price: Number(r.price),
        compare_at_price: r.compareAtPrice ? Number(r.compareAtPrice) : null,
        cost_price: r.costPrice ? Number(r.costPrice) : null,
        stock_qty: r.stockQty ? Number(r.stockQty) : 0,
        sku: r.sku.trim() || null,
        main_image_url: r.mainImageUrl.trim() || mainImageUrl.trim() || null,
      }));

      const linksPayload = selectedRows.flatMap((r, ri) =>
        r.options.map((o, oi) => ({
          variant_id: variantsPayload[ri].id,
          option_id: optionIds[oi],
          value_id: valueIds.get(`${oi}|${o.value}`)!,
        })),
      );

      // Written out rather than looped so each payload is checked against its
      // own table's Insert type — a loop over a {table, payload} union erases
      // that. Order is forced by the foreign keys, and there's no transaction:
      // a failure here leaves the earlier rows behind.
      const fail = (table: string, message: string) => {
        setError(`${table}: ${message}`);
        setSaving(false);
      };

      const optionsRes = await supabase.from("product_options").insert(optionsPayload);
      if (optionsRes.error) return fail("product_options", optionsRes.error.message);

      const valuesRes = await supabase.from("product_option_values").insert(valuesPayload);
      if (valuesRes.error) return fail("product_option_values", valuesRes.error.message);

      const variantsRes = await supabase.from("product_variants").insert(variantsPayload);
      if (variantsRes.error) return fail("product_variants", variantsRes.error.message);

      const linksRes = await supabase.from("product_variant_options").insert(linksPayload);
      if (linksRes.error) return fail("product_variant_options", linksRes.error.message);
    }

    if (collectionIds.length > 0) {
      const { error: collectionsErr } = await supabase.from("product_collections").insert(
        collectionIds.map((collectionId) => ({
          product_id: product.id,
          collection_id: collectionId,
        })),
      );
      if (collectionsErr) {
        setError(`product_collections: ${collectionsErr.message}`);
        setSaving(false);
        return;
      }
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
          onClick={() => setTypeSwitchOpen(true)}
          type="button"
          className="text-sm font-medium text-gray-900 flex items-center gap-1"
        >
          {kind === "regular" ? "Regular product" : "Product with variations"}
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-red-500">{error}</p>}

      <MediaSection mainImageUrl={mainImageUrl} onChange={setMainImageUrl} />

      <DetailsSection
        title={title}
        setTitle={setTitle}
        descriptionShort={descriptionShort}
        onOpenDescription={() => setDescriptionSheetOpen(true)}
        categoryPath={categoryPath}
        onOpenCategoryPicker={() => setCategoryPickerOpen(true)}
        price={price}
        compareAtPrice={compareAtPrice}
        onOpenPriceSheet={() => setPriceSheetOpen(true)}
      />

      {kind === "regular" ? (
        <div className="px-4 py-4 border-b-8 border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[15px] font-semibold text-gray-900">Inventory</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-gray-900">Available</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStockQty((q) => Math.max(0, q - 1))}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
              >
                −
              </button>
              <span className="w-10 text-center text-[15px] font-medium bg-gray-100 rounded-full py-1">
                {stockQty}
              </span>
              <button
                type="button"
                onClick={() => setStockQty((q) => q + 1)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : (
        <VariantMatrixBuilder
          options={options}
          setOptions={setOptions}
          rows={rows}
          setRows={setRows}
        />
      )}

      {kind === "regular" && (
        <ExpandRow
          icon={<Layers size={18} />}
          label="Material"
          value={material}
          expanded={expanded === "material"}
          onToggle={() => toggle("material")}
        >
          <TextField label="Material" value={material} onChange={setMaterial} />
        </ExpandRow>
      )}
      <button
        type="button"
        onClick={() => setCollectionsSheetOpen(true)}
        className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-gray-50 text-left"
      >
        <span className="flex items-center gap-3 text-[15px] text-gray-900">
          <Tag size={18} className="text-gray-400" />
          Collections
        </span>
        <span className="flex items-center gap-2">
          {collectionIds.length > 0 && (
            <span className="text-xs text-gray-400">{collectionIds.length} selected</span>
          )}
          <ChevronRight size={16} className="text-gray-300" />
        </span>
      </button>
      <StubRow icon={<Hash size={18} />} label="Tags" />
      <StubRow icon={<ListChecks size={18} />} label="Necessities" isLast />

      {categoryPickerOpen && (
        <CategoryPicker
          onSelect={(path) => {
            setCategoryPath(path);
            setCategoryPickerOpen(false);
          }}
          onClose={() => setCategoryPickerOpen(false)}
        />
      )}

      {priceSheetOpen && (
        <PricingSheet
          price={price}
          compareAtPrice={compareAtPrice}
          costPrice={costPrice}
          onChangePrice={setPrice}
          onChangeCompareAtPrice={setCompareAtPrice}
          onChangeCostPrice={setCostPrice}
          onClose={() => setPriceSheetOpen(false)}
        />
      )}

      {typeSwitchOpen && (
        <ProductTypeSwitchSheet
          current={kind}
          onSelect={handleTypeSwitch}
          onClose={() => setTypeSwitchOpen(false)}
        />
      )}

      {descriptionSheetOpen && (
        <DescriptionSheet
          value={descriptionShort}
          onSave={(html) => {
            setDescriptionShort(html);
            setDescriptionSheetOpen(false);
          }}
          onClose={() => setDescriptionSheetOpen(false)}
        />
      )}

      {collectionsSheetOpen && (
        <CollectionsSheet
          selectedIds={collectionIds}
          onDone={(ids) => {
            setCollectionIds(ids);
            setCollectionsSheetOpen(false);
          }}
          onClose={() => setCollectionsSheetOpen(false)}
          onCreateNew={handleCreateCollection}
        />
      )}

      {/* TODO: save area — waiting on spec */}
    </div>
  );
}
