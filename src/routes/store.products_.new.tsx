import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronRight, Tag, Hash, ListChecks } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CategoryNode } from "@/lib/categories";
import { StubRow } from "@/components/product-form/ui";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DetailsSection } from "@/components/product-form/DetailsSection";
import { DescriptionSheet } from "@/components/product-form/DescriptionSheet";
import { CollectionsSheet } from "@/components/product-form/CollectionsSheet";
import { TagsSheet } from "@/components/product-form/TagsSheet";
import { NecessitiesSheet } from "@/components/product-form/NecessitiesSheet";
import { PricingSheet } from "@/components/product-form/PricingSheet";
import { InventorySection } from "@/components/product-form/InventorySection";
import { InventorySheet, type InventoryValues } from "@/components/product-form/InventorySheet";
import { CategoryPicker } from "@/components/product-form/CategoryPicker";
import { ProductTypeSwitchSheet } from "@/components/product-form/ProductTypeSwitchSheet";
import {
  VariantMatrixBuilder,
  VariantOption,
  VariantRow,
} from "@/components/product-form/VariantMatrixBuilder";
import { ManualSize, SizeMeasurements, getSizeChartForCategory } from "@/lib/size-chart-config";
import { preloadGuideImage } from "@/components/product-form/size-chart/guide-images";
import {
  stashProductDraft,
  takeProductDraft,
  takePendingNewCollectionId,
} from "@/lib/product-draft-handoff";
import { useActiveStoreId } from "@/hooks/use-own-store";

type ProductKind = "regular" | "variant";

export const Route = createFileRoute("/store/products_/new")({
  // Lets the "Create new product" picker on the products list (see
  // CreateProductTypeModal) open this page with intent instead of always
  // landing on the variant default — the in-page regular/variant switch
  // stays as the fallback for anyone who arrives without picking first.
  validateSearch: (search: Record<string, unknown>): { kind?: ProductKind } => ({
    kind: search.kind === "regular" || search.kind === "variant" ? search.kind : undefined,
  }),
  component: NewProduct,
});

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

function NewProduct() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();
  const { kind: intentKind } = Route.useSearch();

  // Restoring a draft stashed before a side-trip to create a collection — see
  // handleCreateCollection below. Read once via lazy initializers so every
  // field seeds correctly on the very first render (no restore flash).
  const [initialDraft] = useState(() => takeProductDraft());
  const [initialNewCollectionId] = useState(() => takePendingNewCollectionId());

  const [kind, setKind] = useState<ProductKind>(initialDraft?.kind ?? intentKind ?? "variant");
  const [status, setStatus] = useState<"draft" | "active">(initialDraft?.status ?? "draft");
  const [mainImageUrl, setMainImageUrl] = useState(initialDraft?.mainImageUrl ?? "");
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>(
    initialDraft?.additionalImageUrls ?? [],
  );
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [descriptionShort, setDescriptionShort] = useState(initialDraft?.descriptionShort ?? "");
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [categoryPath, setCategoryPath] = useState<CategoryNode[]>(
    initialDraft?.categoryPath ?? [],
  );

  // Kick off the size-chart guide image fetch the moment a category is
  // picked, so it's already cached by the time the seller opens Necessities.
  useEffect(() => {
    const chart = getSizeChartForCategory(categoryPath);
    if (chart) preloadGuideImage(chart.guide);
  }, [categoryPath]);

  // Regular-mode state
  const [price, setPrice] = useState(initialDraft?.price ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(initialDraft?.compareAtPrice ?? "");
  const [costPrice, setCostPrice] = useState(initialDraft?.costPrice ?? "");
  const [regularSku, setRegularSku] = useState(initialDraft?.regularSku ?? "");
  const [regularBarcode, setRegularBarcode] = useState(initialDraft?.regularBarcode ?? "");
  const [regularContinueSellingOutOfStock, setRegularContinueSellingOutOfStock] = useState(
    initialDraft?.regularContinueSellingOutOfStock ?? false,
  );
  const [regularLocationQuantities, setRegularLocationQuantities] = useState<
    Record<string, number>
  >(initialDraft?.regularLocationQuantities ?? {});
  const [inventorySheetOpen, setInventorySheetOpen] = useState(false);
  const regularStockQty = Object.values(regularLocationQuantities).reduce((sum, n) => sum + n, 0);
  // No UI sets this on this page anymore — material is filled in via
  // Necessities now. Still round-tripped through drafts/save.
  const material = initialDraft?.material ?? "";

  // Variant-mode state
  const [options, setOptions] = useState<VariantOption[]>(initialDraft?.options ?? []);
  const [rows, setRows] = useState<VariantRow[]>(initialDraft?.rows ?? []);
  const [sizeMeasurements, setSizeMeasurements] = useState<SizeMeasurements>(
    initialDraft?.sizeMeasurements ?? {},
  );
  // Manual size pick — only meaningful when there's no Variant Size axis
  // (regular products, or variant products that only vary by e.g. Color).
  const [manualSize, setManualSize] = useState<ManualSize | null>(initialDraft?.manualSize ?? null);

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
  const [tagsSheetOpen, setTagsSheetOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [necessitiesSheetOpen, setNecessitiesSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function handleCreateCollection() {
    stashProductDraft({
      kind,
      status,
      mainImageUrl,
      additionalImageUrls,
      title,
      descriptionShort,
      categoryPath,
      price,
      compareAtPrice,
      costPrice,
      stockQty: regularStockQty,
      regularSku,
      regularBarcode,
      regularContinueSellingOutOfStock,
      regularLocationQuantities,
      material,
      options,
      rows,
      collectionIds,
      sizeMeasurements,
      manualSize,
    });
    navigate({ to: "/store/collections/new" });
  }

  // Sellers can uncheck combinations they don't stock — only these get written.
  const selectedRows = rows.filter((r) => r.selected);

  function handleTypeSwitch(next: ProductKind) {
    setTypeSwitchOpen(false);
    setKind(next);
  }

  async function handleSave() {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
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
        store_id: storeId,
        handle: slugify(title),
        title: title.trim(),
        description_short: descriptionShort.trim() || null,
        product_type: categoryPath.at(-1)?.name || null,
        status,
        source_platform: "manual",
        is_complete: true,
        manual_size_value: manualSize?.value ?? null,
        manual_size_system: manualSize?.system ?? null,
      })
      .select("id")
      .single();

    if (productErr || !product) {
      setError(productErr?.message ?? "Failed to create product");
      setSaving(false);
      return;
    }

    // Written out rather than looped so each payload is checked against its
    // own table's Insert type — a loop over a {table, payload} union erases
    // that. Order is forced by the foreign keys, and there's no transaction:
    // a failure here leaves the earlier rows behind.
    const fail = (table: string, message: string) => {
      setError(`${table}: ${message}`);
      setSaving(false);
    };

    if (kind === "regular") {
      const { data: variant, error: variantErr } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          price: Number(price),
          compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
          cost_price: costPrice ? Number(costPrice) : null,
          stock_qty: regularStockQty,
          sku: regularSku.trim() || null,
          barcode: regularBarcode.trim() || null,
          continue_selling_out_of_stock: regularContinueSellingOutOfStock,
          material: material.trim() || null,
          main_image_url: mainImageUrl.trim() || null,
          additional_image_urls: additionalImageUrls.length > 0 ? additionalImageUrls : null,
        })
        .select("id")
        .single();
      if (variantErr || !variant) {
        setError(variantErr?.message ?? "Failed to create product variant");
        setSaving(false);
        return;
      }
      const stockPayload = Object.entries(regularLocationQuantities).map(
        ([locationId, quantity]) => ({ variant_id: variant.id, location_id: locationId, quantity }),
      );
      if (stockPayload.length > 0) {
        const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
        if (stockRes.error) return fail("product_variant_stock", stockRes.error.message);
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
        stock_qty: Object.values(r.locationQuantities).reduce((sum, n) => sum + n, 0),
        sku: r.sku.trim() || null,
        continue_selling_out_of_stock: r.continueSellingOutOfStock,
        main_image_url: r.mainImageUrl.trim() || mainImageUrl.trim() || null,
        additional_image_urls: r.additionalImageUrls ?? null,
      }));

      const stockPayload = selectedRows.flatMap((r, ri) =>
        Object.entries(r.locationQuantities).map(([locationId, quantity]) => ({
          variant_id: variantsPayload[ri].id,
          location_id: locationId,
          quantity,
        })),
      );

      const linksPayload = selectedRows.flatMap((r, ri) =>
        r.options.map((o, oi) => ({
          variant_id: variantsPayload[ri].id,
          option_id: optionIds[oi],
          value_id: valueIds.get(`${oi}|${o.value}`)!,
        })),
      );

      const optionsRes = await supabase.from("product_options").insert(optionsPayload);
      if (optionsRes.error) return fail("product_options", optionsRes.error.message);

      const valuesRes = await supabase.from("product_option_values").insert(valuesPayload);
      if (valuesRes.error) return fail("product_option_values", valuesRes.error.message);

      const variantsRes = await supabase.from("product_variants").insert(variantsPayload);
      if (variantsRes.error) return fail("product_variants", variantsRes.error.message);

      const linksRes = await supabase.from("product_variant_options").insert(linksPayload);
      if (linksRes.error) return fail("product_variant_options", linksRes.error.message);

      if (stockPayload.length > 0) {
        const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
        if (stockRes.error) return fail("product_variant_stock", stockRes.error.message);
      }
    }

    // Not kind-gated: a regular product (or a variant product with no Size
    // axis) can still have measurements against its manually-picked size.
    const measurementsPayload = Object.entries(sizeMeasurements).flatMap(([sizeValue, byKey]) =>
      Object.entries(byKey).map(([measurementKey, valueCm]) => ({
        product_id: product.id,
        size_value: sizeValue,
        measurement_key: measurementKey,
        value_cm: valueCm,
      })),
    );
    if (measurementsPayload.length > 0) {
      const measurementsRes = await supabase
        .from("product_size_measurements")
        .insert(measurementsPayload);
      if (measurementsRes.error)
        return fail("product_size_measurements", measurementsRes.error.message);
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

    if (tagIds.length > 0) {
      const { error: tagsErr } = await supabase.from("product_tags").insert(
        tagIds.map((tagId) => ({
          product_id: product.id,
          tag_id: tagId,
        })),
      );
      if (tagsErr) {
        setError(`product_tags: ${tagsErr.message}`);
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

      <MediaSection
        mainImageUrl={mainImageUrl}
        onChange={setMainImageUrl}
        additionalImageUrls={additionalImageUrls}
        onAdditionalChange={setAdditionalImageUrls}
      />

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
        showPrice={kind === "regular"}
      />

      {kind === "regular" ? (
        <InventorySection
          available={regularStockQty}
          locationCount={Object.keys(regularLocationQuantities).length}
          onOpen={() => setInventorySheetOpen(true)}
        />
      ) : (
        storeId && (
          <VariantMatrixBuilder
            options={options}
            setOptions={setOptions}
            rows={rows}
            setRows={setRows}
            mainImageUrl={mainImageUrl}
            additionalImageUrls={additionalImageUrls}
            storeId={storeId}
          />
        )
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
      <StubRow icon={<Hash size={18} />} label="Tags" onClick={() => setTagsSheetOpen(true)} />
      <StubRow
        icon={<ListChecks size={18} />}
        label="Necessities"
        isLast
        onClick={() => setNecessitiesSheetOpen(true)}
      />

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

      {inventorySheetOpen && storeId && (
        <InventorySheet
          storeId={storeId}
          initial={{
            sku: regularSku,
            barcode: regularBarcode,
            continueSellingOutOfStock: regularContinueSellingOutOfStock,
            locationQuantities: regularLocationQuantities,
          }}
          onSave={(values: InventoryValues) => {
            setRegularSku(values.sku);
            setRegularBarcode(values.barcode);
            setRegularContinueSellingOutOfStock(values.continueSellingOutOfStock);
            setRegularLocationQuantities(values.locationQuantities);
            setInventorySheetOpen(false);
          }}
          onClose={() => setInventorySheetOpen(false)}
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

      {collectionsSheetOpen && storeId && (
        <CollectionsSheet
          storeId={storeId}
          selectedIds={collectionIds}
          onDone={(ids) => {
            setCollectionIds(ids);
            setCollectionsSheetOpen(false);
          }}
          onClose={() => setCollectionsSheetOpen(false)}
          onCreateNew={handleCreateCollection}
        />
      )}

      {tagsSheetOpen && storeId && (
        <TagsSheet
          storeId={storeId}
          selectedIds={tagIds}
          onToggle={toggleTag}
          onClose={() => setTagsSheetOpen(false)}
        />
      )}

      {necessitiesSheetOpen && (
        <NecessitiesSheet
          categoryPath={categoryPath}
          kind={kind}
          options={options}
          material={material}
          sizeMeasurements={sizeMeasurements}
          onChangeSizeMeasurements={setSizeMeasurements}
          manualSize={manualSize}
          onChangeManualSize={setManualSize}
          onClose={() => setNecessitiesSheetOpen(false)}
        />
      )}

      <div className="px-4 py-5 border-b-8 border-gray-50">
        <p className="text-[15px] font-semibold text-gray-900 mb-3">Product Status</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStatus("active")}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface ${
              status === "active"
                ? "border-black bg-gray-50 text-gray-900"
                : "border-gray-200 text-gray-500"
            }`}
          >
            Published
          </button>
          <button
            type="button"
            onClick={() => setStatus("draft")}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface ${
              status === "draft"
                ? "border-black bg-gray-50 text-gray-900"
                : "border-gray-200 text-gray-500"
            }`}
          >
            Unpublished
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !storeId}
          className="w-full bg-black text-white text-sm font-semibold rounded-full py-4 disabled:opacity-50 oak-motion-control active:scale-[0.98]"
        >
          {saving ? "Saving…" : "Save Product"}
        </button>
      </div>
    </div>
  );
}
