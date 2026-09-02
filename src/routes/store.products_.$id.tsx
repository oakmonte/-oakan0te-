import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Tag,
  Hash,
  ListChecks,
  MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CategoryNode, ROOT_CATEGORY } from "@/lib/categories";
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
import { WeightSection } from "@/components/product-form/WeightSection";
import { WeightSheet } from "@/components/product-form/WeightSheet";
import { CategoryPicker } from "@/components/product-form/CategoryPicker";
import { ProductTypeSwitchSheet } from "@/components/product-form/ProductTypeSwitchSheet";
import { ProductActionsSheet } from "@/components/product-form/ProductActionsSheet";
import {
  VariantMatrixBuilder,
  VariantOption,
  VariantOptionValue,
  VariantRow,
} from "@/components/product-form/VariantMatrixBuilder";
import { stockTotal } from "@/components/product-form/variant-stock";
import { cartesian, buildKey } from "@/components/product-form/variant-combinations";
import { ManualSize, SizeMeasurements, getSizeChartForCategory } from "@/lib/size-chart-config";
import { estimateWeightGrams } from "@/lib/weight-estimate";
import { preloadGuideImage } from "@/components/product-form/size-chart/guide-images";
import {
  stashProductDraft,
  takeProductDraft,
  takePendingNewCollectionId,
  takePendingNewLocationId,
  readAutosavedDraft,
  writeAutosavedDraft,
  clearAutosavedDraft,
} from "@/lib/product-draft-handoff";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useStoreHeader } from "@/hooks/use-store-header";
import { Spinner } from "@/components/spinner";

export const Route = createFileRoute("/store/products_/$id")({
  component: EditProduct,
});

type ProductKind = "regular" | "variant";

// Resolves products.product_type (a free-text leaf name — the manual form
// never writes category_id, see canonical-product-schema skill) back onto a
// CategoryNode path by matching the leaf's name. Best-effort: if the name was
// edited, renamed upstream, or never resolved to begin with, this just comes
// back null and the seller re-picks — the same "missing beats wrong" stance
// the import contract takes for category_id.
function findCategoryPathByName(name: string): CategoryNode[] | null {
  function walk(node: CategoryNode, path: CategoryNode[]): CategoryNode[] | null {
    for (const child of node.children ?? []) {
      const nextPath = [...path, child];
      if (child.name.toLowerCase() === name.trim().toLowerCase()) return nextPath;
      const found = walk(child, nextPath);
      if (found) return found;
    }
    return null;
  }
  return walk(ROOT_CATEGORY, []);
}

type LoadedProduct = {
  id: string;
  title: string | null;
  description_short: string | null;
  product_type: string | null;
  status: string;
  manual_size_value: string | null;
  manual_size_system: string | null;
  product_variants: {
    id: string;
    sku: string | null;
    price: number | null;
    compare_at_price: number | null;
    cost_price: number | null;
    stock_qty: number | null;
    material: string | null;
    main_image_url: string | null;
    barcode: string | null;
    material_feel: string | null;
    weight_grams: number | null;
    additional_image_urls: string[] | null;
    continue_selling_out_of_stock: boolean;
    product_variant_options: { variant_id: string; option_id: string; value_id: string }[];
    product_variant_stock: { location_id: string; quantity: number }[];
  }[];
  product_options: {
    id: string;
    name: string;
    position: number;
    product_option_values: { id: string; value: string; position: number }[];
  }[];
  product_collections: { collection_id: string }[];
  product_tags: { tag_id: string }[];
  product_size_measurements: { size_value: string; measurement_key: string; value_cm: number }[];
};

function EditProduct() {
  const navigate = useNavigate();
  const { id: productId } = Route.useParams();
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const { setRightAction } = useStoreHeader();

  // Two sources of "come back to where I was," checked in order: a draft
  // stashed just before a side-trip to create a collection/location (see
  // handleCreateCollection below) always wins since it's the most recent
  // state; only trusted when it actually names this product, so a draft left
  // over from somewhere else can't silently overwrite an unrelated product's
  // form. Otherwise fall back to the autosaved draft from localStorage,
  // which is what survives an actual page refresh — either way, having one
  // means there's nothing to fetch, the draft IS the current form state.
  const [handoffDraft] = useState(() => {
    const draft = takeProductDraft();
    return draft && draft.productId === productId ? draft : null;
  });
  const [restoredFromAutosave] = useState(() => !handoffDraft && !!readAutosavedDraft(productId));
  const [initialDraft] = useState(() => handoffDraft ?? readAutosavedDraft(productId));
  const [initialNewCollectionId] = useState(() => takePendingNewCollectionId());

  const [loading, setLoading] = useState(initialDraft === null);
  const [notFound, setNotFound] = useState(false);

  const [kind, setKind] = useState<ProductKind>(initialDraft?.kind ?? "variant");
  const [status, setStatus] = useState<"draft" | "active">(initialDraft?.status ?? "draft");
  const [mainImageUrl, setMainImageUrl] = useState(initialDraft?.mainImageUrl ?? "");
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [descriptionShort, setDescriptionShort] = useState(initialDraft?.descriptionShort ?? "");
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [categoryPath, setCategoryPath] = useState<CategoryNode[]>(
    initialDraft?.categoryPath ?? [],
  );

  // Reused both to kick off the guide-image preload below and to pick which
  // weight-estimate formula applies (see weight-estimate.ts) — stable across
  // renders for the same category since CHARTS_BY_CATEGORY always returns
  // the same object reference.
  const chart = getSizeChartForCategory(categoryPath);

  useEffect(() => {
    if (chart) preloadGuideImage(chart.guide);
  }, [chart]);

  // Regular-mode state
  const [price, setPrice] = useState(initialDraft?.price ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(initialDraft?.compareAtPrice ?? "");
  const [costPrice, setCostPrice] = useState(initialDraft?.costPrice ?? "");
  const [material, setMaterial] = useState(initialDraft?.material ?? "");
  const [regularContinueSellingOutOfStock, setRegularContinueSellingOutOfStock] = useState(
    initialDraft?.regularContinueSellingOutOfStock ?? false,
  );
  const [regularLocationQuantities, setRegularLocationQuantities] = useState<
    Record<string, number>
  >(() => {
    const base = initialDraft?.regularLocationQuantities ?? {};
    const pendingLocationId = takePendingNewLocationId();
    return pendingLocationId && !(pendingLocationId in base)
      ? { ...base, [pendingLocationId]: 0 }
      : base;
  });
  const [inventorySheetOpen, setInventorySheetOpen] = useState(false);
  // Stock saved before per-location inventory existed has no location rows;
  // keep it so an unrelated edit + Save doesn't zero the product's stock.
  const [regularLegacyStockQty, setRegularLegacyStockQty] = useState(0);
  const regularStockQty = stockTotal({
    locationQuantities: regularLocationQuantities,
    legacyStockQty: regularLegacyStockQty,
  });
  // No UI edits these yet (mirrors "material" on the new-product form) —
  // round-tripped so opening an imported product and saving doesn't drop them.
  const [regularBarcode, setRegularBarcode] = useState<string | null>(null);
  const [regularMaterialFeel, setRegularMaterialFeel] = useState<string | null>(null);
  const [regularWeightGrams, setRegularWeightGrams] = useState<number | null>(
    initialDraft?.regularWeightGrams ?? null,
  );
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [regularAdditionalImageUrls, setRegularAdditionalImageUrls] = useState<string[] | null>(
    initialDraft?.additionalImageUrls ?? null,
  );

  // Variant-mode state
  const [options, setOptions] = useState<VariantOption[]>(initialDraft?.options ?? []);
  const [rows, setRows] = useState<VariantRow[]>(initialDraft?.rows ?? []);
  const [sizeMeasurements, setSizeMeasurements] = useState<SizeMeasurements>(
    initialDraft?.sizeMeasurements ?? {},
  );
  const [manualSize, setManualSize] = useState<ManualSize | null>(initialDraft?.manualSize ?? null);

  // A regular product has no Variant Size axis, so its own measurements (if
  // any were picked via the size chart) live under manualSize's value.
  const regularWeightEstimate = chart
    ? estimateWeightGrams(chart.guide, sizeMeasurements[manualSize?.value ?? ""] ?? {}, material)
    : null;

  // Per-row suggestion for the variant matrix: prefer the row's own Size/
  // Material option values over the shared manualSize/material fallback,
  // since a variant product's rows can each be a different size or fabric.
  function estimateWeightForRow(row: VariantRow): number | null {
    if (!chart) return null;
    const rowSize = row.options.find((o) => o.name.trim().toLowerCase() === "size")?.value;
    const rowMaterial = row.options.find((o) => o.name.trim().toLowerCase() === "material")?.value;
    const measurements = sizeMeasurements[rowSize ?? manualSize?.value ?? ""] ?? {};
    return estimateWeightGrams(chart.guide, measurements, rowMaterial ?? material);
  }

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [typeSwitchOpen, setTypeSwitchOpen] = useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
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
  const [showRestoredBanner, setShowRestoredBanner] = useState(restoredFromAutosave);

  // Render the horizontal three-dot delete trigger in the shared store header.
  useEffect(() => {
    setRightAction(
      <button
        type="button"
        onClick={() => setActionsSheetOpen(true)}
        aria-label="Product actions"
        className="p-1 -mr-1 text-gray-900"
      >
        <MoreHorizontal size={20} />
      </button>,
    );
    return () => setRightAction(null);
  }, [setRightAction]);

  // Loads the product once, unless a stashed draft already seeded every
  // field above (the collection side-trip round-trip) — in that case there's
  // nothing to fetch, the draft IS the current form state.
  useEffect(() => {
    if (initialDraft) return;
    if (!storeId || !productId) return;
    let cancelled = false;

    (async () => {
      const { data, error: loadErr } = await supabase
        .from("products")
        .select(
          `id, title, description_short, product_type, status, manual_size_value, manual_size_system,
           product_variants(id, sku, price, compare_at_price, cost_price, stock_qty, material, main_image_url, barcode, material_feel, weight_grams, additional_image_urls, continue_selling_out_of_stock, product_variant_options(variant_id, option_id, value_id), product_variant_stock(location_id, quantity)),
           product_options(id, name, position, product_option_values(id, value, position)),
           product_collections(collection_id),
           product_tags(tag_id),
           product_size_measurements(size_value, measurement_key, value_cm)`,
        )
        .eq("id", productId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (cancelled) return;
      if (loadErr || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const product = data as unknown as LoadedProduct;

      const sortedOptions = [...product.product_options].sort((a, b) => a.position - b.position);
      const optionsState: VariantOption[] = sortedOptions.map((o) => ({
        name: o.name,
        values: [...o.product_option_values]
          .sort((a, b) => a.position - b.position)
          .map((v) => v.value),
      }));

      // value_id -> which option (by name) and which value it names, so a
      // variant's links can be turned into the {name, value} pairs the rest
      // of this form works with instead of raw ids.
      const valueLookup = new Map<string, VariantOptionValue>();
      for (const o of sortedOptions) {
        for (const v of o.product_option_values)
          valueLookup.set(v.id, { name: o.name, value: v.value });
      }
      const optionOrder = new Map(optionsState.map((o, i) => [o.name, i]));

      const variantOptionValues = new Map<string, VariantOptionValue[]>();
      for (const v of product.product_variants) {
        for (const link of v.product_variant_options) {
          const info = valueLookup.get(link.value_id);
          if (!info) continue;
          const arr = variantOptionValues.get(link.variant_id) ?? [];
          arr.push(info);
          variantOptionValues.set(link.variant_id, arr);
        }
      }
      for (const arr of variantOptionValues.values()) {
        arr.sort((a, b) => (optionOrder.get(a.name) ?? 0) - (optionOrder.get(b.name) ?? 0));
      }

      const kindState: ProductKind = optionsState.length > 0 ? "variant" : "regular";

      if (kindState === "variant") {
        // Every combo the option set allows, not just the ones that became
        // variants — an unchecked combination has no product_variants row at
        // all, so without regenerating the full set here it would silently
        // come back checked (VariantMatrixBuilder defaults a combo with no
        // match to selected: true) the next time this product is opened.
        const byKey = new Map(
          product.product_variants.map((v) => {
            const optVals = variantOptionValues.get(v.id) ?? [];
            return [buildKey(optVals), v] as const;
          }),
        );

        const rowsState: VariantRow[] = cartesian(optionsState).map((combo) => {
          const key = buildKey(combo);
          const v = byKey.get(key);
          if (!v) {
            return {
              key,
              options: combo,
              selected: false,
              price: "",
              compareAtPrice: "",
              costPrice: "",
              sku: "",
              mainImageUrl: "",
              continueSellingOutOfStock: false,
              locationQuantities: {},
            };
          }
          return {
            key,
            options: combo,
            selected: true,
            price: v.price != null ? String(v.price) : "",
            compareAtPrice: v.compare_at_price != null ? String(v.compare_at_price) : "",
            costPrice: v.cost_price != null ? String(v.cost_price) : "",
            sku: v.sku ?? "",
            mainImageUrl: v.main_image_url ?? "",
            continueSellingOutOfStock: v.continue_selling_out_of_stock,
            locationQuantities: Object.fromEntries(
              v.product_variant_stock.map((s) => [s.location_id, s.quantity]),
            ),
            legacyStockQty: v.product_variant_stock.length === 0 ? (v.stock_qty ?? 0) : undefined,
            barcode: v.barcode,
            material: v.material,
            materialFeel: v.material_feel,
            weightGrams: v.weight_grams,
            additionalImageUrls: v.additional_image_urls,
          };
        });

        setOptions(optionsState);
        setRows(rowsState);
        setMainImageUrl(product.product_variants[0]?.main_image_url ?? "");
      } else {
        const v = product.product_variants[0];
        setPrice(v?.price != null ? String(v.price) : "");
        setCompareAtPrice(v?.compare_at_price != null ? String(v.compare_at_price) : "");
        setCostPrice(v?.cost_price != null ? String(v.cost_price) : "");
        setMaterial(v?.material ?? "");
        setMainImageUrl(v?.main_image_url ?? "");
        setRegularBarcode(v?.barcode ?? null);
        setRegularContinueSellingOutOfStock(v?.continue_selling_out_of_stock ?? false);
        setRegularLocationQuantities(
          Object.fromEntries(
            (v?.product_variant_stock ?? []).map((s) => [s.location_id, s.quantity]),
          ),
        );
        setRegularLegacyStockQty(
          (v?.product_variant_stock ?? []).length === 0 ? (v?.stock_qty ?? 0) : 0,
        );
        setRegularMaterialFeel(v?.material_feel ?? null);
        setRegularWeightGrams(v?.weight_grams ?? null);
        setRegularAdditionalImageUrls(v?.additional_image_urls ?? null);
      }

      setKind(kindState);
      setStatus(product.status === "active" ? "active" : "draft");
      setTitle(product.title ?? "");
      setDescriptionShort(product.description_short ?? "");
      setCategoryPath(
        product.product_type ? (findCategoryPathByName(product.product_type) ?? []) : [],
      );

      if (product.manual_size_value && product.manual_size_system) {
        setManualSize({ value: product.manual_size_value, system: product.manual_size_system });
      }

      const measurements: SizeMeasurements = {};
      for (const m of product.product_size_measurements) {
        measurements[m.size_value] ??= {};
        measurements[m.size_value][m.measurement_key] = m.value_cm;
      }
      setSizeMeasurements(measurements);

      setCollectionIds((prev) => {
        const fromDb = product.product_collections.map((c) => c.collection_id);
        return initialNewCollectionId && !fromDb.includes(initialNewCollectionId)
          ? [...fromDb, initialNewCollectionId]
          : fromDb.length
            ? fromDb
            : prev;
      });
      setTagIds(product.product_tags.map((t) => t.tag_id));

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, productId, initialDraft]);

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  // Shared by both side-trips below — a seller can leave this form to create
  // a collection or a pickup location mid-edit, and either way needs the
  // whole draft stashed so nothing edited so far is lost on return.
  function currentDraft() {
    return {
      productId,
      kind,
      status,
      mainImageUrl,
      additionalImageUrls: regularAdditionalImageUrls,
      title,
      descriptionShort,
      categoryPath,
      price,
      compareAtPrice,
      costPrice,
      stockQty: regularStockQty,
      regularContinueSellingOutOfStock,
      regularLocationQuantities,
      regularWeightGrams,
      material,
      options,
      rows,
      collectionIds,
      sizeMeasurements,
      manualSize,
    };
  }

  // Debounced localStorage autosave — the only thing that survives a hard
  // refresh. Guarded on `loading` so the still-fetching, mostly-blank form
  // doesn't overwrite a real autosave (or the product's actual saved state)
  // before the DB load has even populated it. JSON.stringify as the dep is
  // deliberate: simplest way to react to "any field actually changed"
  // without listing every piece of state that feeds currentDraft() by hand.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => writeAutosavedDraft(productId, currentDraft()), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, JSON.stringify(currentDraft())]);

  function handleCreateCollection() {
    stashProductDraft(currentDraft());
    navigate({ to: "/store/collections/new" });
  }

  function handleCreateLocation() {
    stashProductDraft(currentDraft());
    navigate({ to: "/store/locations/new" });
  }

  const selectedRows = rows.filter((r) => r.selected);

  function handleTypeSwitch(next: ProductKind) {
    setTypeSwitchOpen(false);
    setKind(next);
  }

  // product_tags has no ON DELETE CASCADE on product_id (unlike its sibling
  // tables — product_variants/product_options/product_collections/
  // product_size_measurements all cascade), so a tagged product must have its
  // tags cleared first or the products delete fails on the FK constraint.
  async function handleDeleteProduct() {
    const { error: tagsErr } = await supabase
      .from("product_tags")
      .delete()
      .eq("product_id", productId);
    if (tagsErr) throw new Error(tagsErr.message);

    const { error: productErr } = await supabase.from("products").delete().eq("id", productId);
    if (productErr) throw new Error(productErr.message);

    clearAutosavedDraft(productId);
    navigate({ to: "/store/products" });
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

    const { error: productErr } = await supabase
      .from("products")
      .update({
        title: title.trim(),
        description_short: descriptionShort.trim() || null,
        product_type: categoryPath.at(-1)?.name || null,
        status,
        is_complete: true,
        manual_size_value: manualSize?.value ?? null,
        manual_size_system: manualSize?.system ?? null,
      })
      // handle, source_platform, external_handle and category_id are
      // deliberately left out of this payload: handle is the public slug (a
      // seller renaming the title must not change their product's URL), and
      // the rest are provenance an edit here shouldn't touch.
      .eq("id", productId);

    if (productErr) {
      setError(productErr.message);
      setSaving(false);
      return;
    }

    const fail = (table: string, message: string) => {
      setError(`${table}: ${message}`);
      setSaving(false);
    };

    // Rebuild children from scratch rather than diffing them by id — same
    // choice execute.js makes for imports, for the same reason: diffing
    // sounds better until a seller renames or removes an option, at which
    // point it silently strands the old rows. product_variants cascades
    // product_variant_options; product_options cascades product_option_values.
    const variantsDel = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);
    if (variantsDel.error) return fail("product_variants", variantsDel.error.message);
    const optionsDel = await supabase.from("product_options").delete().eq("product_id", productId);
    if (optionsDel.error) return fail("product_options", optionsDel.error.message);

    if (kind === "regular") {
      const { data: variant, error: variantErr } = await supabase
        .from("product_variants")
        .insert({
          product_id: productId,
          price: Number(price),
          compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
          cost_price: costPrice ? Number(costPrice) : null,
          stock_qty: regularStockQty,
          material: material.trim() || null,
          main_image_url: mainImageUrl.trim() || null,
          barcode: regularBarcode,
          continue_selling_out_of_stock: regularContinueSellingOutOfStock,
          material_feel: regularMaterialFeel,
          weight_grams: regularWeightGrams,
          additional_image_urls: regularAdditionalImageUrls,
        })
        .select("id")
        .single();
      if (variantErr || !variant)
        return fail("product_variants", variantErr?.message ?? "insert failed");

      const stockPayload = Object.entries(regularLocationQuantities).map(
        ([locationId, quantity]) => ({ variant_id: variant.id, location_id: locationId, quantity }),
      );
      if (stockPayload.length > 0) {
        const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
        if (stockRes.error) return fail("product_variant_stock", stockRes.error.message);
      }
    } else {
      const usableOptions = options.filter((o) => o.name.trim() && o.values.length > 0);

      const optionIds = usableOptions.map(() => crypto.randomUUID());
      const valueIds = new Map<string, string>();

      const optionsPayload = usableOptions.map((o, i) => ({
        id: optionIds[i],
        product_id: productId,
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
        product_id: productId,
        option1_name: r.options[0]?.name ?? null,
        option1_value: r.options[0]?.value ?? null,
        option2_name: r.options[1]?.name ?? null,
        option2_value: r.options[1]?.value ?? null,
        option3_name: r.options[2]?.name ?? null,
        option3_value: r.options[2]?.value ?? null,
        price: Number(r.price),
        compare_at_price: r.compareAtPrice ? Number(r.compareAtPrice) : null,
        cost_price: r.costPrice ? Number(r.costPrice) : null,
        stock_qty: stockTotal(r),
        sku: r.sku.trim() || null,
        continue_selling_out_of_stock: r.continueSellingOutOfStock,
        main_image_url: r.mainImageUrl.trim() || mainImageUrl.trim() || null,
        barcode: r.barcode ?? null,
        material: r.material ?? null,
        material_feel: r.materialFeel ?? null,
        weight_grams: r.weightGrams ?? null,
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

    const measurementsDel = await supabase
      .from("product_size_measurements")
      .delete()
      .eq("product_id", productId);
    if (measurementsDel.error)
      return fail("product_size_measurements", measurementsDel.error.message);

    const measurementsPayload = Object.entries(sizeMeasurements).flatMap(([sizeValue, byKey]) =>
      Object.entries(byKey).map(([measurementKey, valueCm]) => ({
        product_id: productId,
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

    const collectionsDel = await supabase
      .from("product_collections")
      .delete()
      .eq("product_id", productId);
    if (collectionsDel.error) return fail("product_collections", collectionsDel.error.message);
    if (collectionIds.length > 0) {
      const { error: collectionsErr } = await supabase.from("product_collections").insert(
        collectionIds.map((collectionId) => ({
          product_id: productId,
          collection_id: collectionId,
        })),
      );
      if (collectionsErr) return fail("product_collections", collectionsErr.message);
    }

    const tagsDel = await supabase.from("product_tags").delete().eq("product_id", productId);
    if (tagsDel.error) return fail("product_tags", tagsDel.error.message);
    if (tagIds.length > 0) {
      const { error: tagsErr } = await supabase
        .from("product_tags")
        .insert(tagIds.map((tagId) => ({ product_id: productId, tag_id: tagId })));
      if (tagsErr) return fail("product_tags", tagsErr.message);
    }

    clearAutosavedDraft(productId);
    navigate({ to: "/store/products" });
  }

  if (storeLoading || loading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <Spinner className="text-gray-300" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-dvh bg-white px-4 py-8">
        <p className="text-sm text-gray-500 mb-4">
          This product doesn't exist, or isn't on your store.
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: "/store/products" })}
          className="text-sm font-medium text-black"
        >
          Back to products
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-14 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
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

      {showRestoredBanner && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-xs text-gray-500">Restored your unsaved progress from last time.</p>
          <button
            type="button"
            onClick={() => setShowRestoredBanner(false)}
            className="text-xs font-medium text-gray-900 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="px-4 pt-3 text-sm text-red-500">{error}</p>}

      <MediaSection
        mainImageUrl={mainImageUrl}
        onChange={setMainImageUrl}
        additionalImageUrls={regularAdditionalImageUrls ?? []}
        onAdditionalChange={(urls) => setRegularAdditionalImageUrls(urls.length > 0 ? urls : null)}
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
        <>
          <InventorySection
            available={regularStockQty}
            locationCount={Object.keys(regularLocationQuantities).length}
            onOpen={() => setInventorySheetOpen(true)}
          />
          <WeightSection grams={regularWeightGrams} onOpen={() => setWeightSheetOpen(true)} />
        </>
      ) : (
        storeId && (
          <VariantMatrixBuilder
            options={options}
            setOptions={setOptions}
            rows={rows}
            setRows={setRows}
            mainImageUrl={mainImageUrl}
            additionalImageUrls={regularAdditionalImageUrls ?? []}
            storeId={storeId}
            onCreateLocation={handleCreateLocation}
            estimateWeightForRow={estimateWeightForRow}
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
            continueSellingOutOfStock: regularContinueSellingOutOfStock,
            locationQuantities: regularLocationQuantities,
          }}
          onCreateLocation={handleCreateLocation}
          onSave={(values: InventoryValues) => {
            setRegularContinueSellingOutOfStock(values.continueSellingOutOfStock);
            setRegularLocationQuantities(values.locationQuantities);
            setInventorySheetOpen(false);
          }}
          onClose={() => setInventorySheetOpen(false)}
        />
      )}

      {weightSheetOpen && (
        <WeightSheet
          initial={regularWeightGrams}
          estimate={regularWeightEstimate}
          onSave={(grams) => {
            setRegularWeightGrams(grams);
            setWeightSheetOpen(false);
          }}
          onClose={() => setWeightSheetOpen(false)}
        />
      )}

      {typeSwitchOpen && (
        <ProductTypeSwitchSheet
          current={kind}
          onSelect={handleTypeSwitch}
          onClose={() => setTypeSwitchOpen(false)}
        />
      )}

      {actionsSheetOpen && (
        <ProductActionsSheet
          onClose={() => setActionsSheetOpen(false)}
          onDelete={handleDeleteProduct}
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
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
