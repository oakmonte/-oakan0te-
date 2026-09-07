import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { startProductSave } from "@/lib/product-save";
import { CategoryNode, ROOT_CATEGORY } from "@/lib/categories";
import { StubRow } from "@/components/product-form/ui";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DetailsSection } from "@/components/product-form/DetailsSection";
import { DescriptionSheet } from "@/components/product-form/DescriptionSheet";
import { CollectionsSheet } from "@/components/product-form/CollectionsSheet";
import { TagsSheet } from "@/components/product-form/TagsSheet";
import { NecessitiesSheet } from "@/components/product-form/NecessitiesSheet";
import { NecessitiesWarningDialog } from "@/components/product-form/NecessitiesWarningDialog";
import { allNecessitiesFilled, normalizeOptionName } from "@/lib/necessities";
import { PricingSheet } from "@/components/product-form/PricingSheet";
import { InventorySection } from "@/components/product-form/InventorySection";
import { InventorySheet, type InventoryValues } from "@/components/product-form/InventorySheet";
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
import { toBarcodeType, type BarcodeEntry } from "@/lib/barcode-types";
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
    material_feel: string | null;
    weight_grams: number | null;
    additional_image_urls: string[] | null;
    continue_selling_out_of_stock: boolean;
    product_variant_options: { variant_id: string; option_id: string; value_id: string }[];
    product_variant_stock: { location_id: string; quantity: number }[];
    product_variant_barcodes: { type: string; value: string; position: number }[];
    // Deprecated (see product_variant_barcodes above) but still fetched: an
    // importer (CSV/Bumpa) writes only this column, never the new table, so
    // without reading it here an imported product's barcode would silently
    // vanish the moment a seller opens and saves it — the load below falls
    // back to this whenever product_variant_barcodes comes back empty.
    barcode: string | null;
  }[];
  product_options: {
    id: string;
    name: string;
    position: number;
    product_option_values: { id: string; value: string; position: number }[];
  }[];
  product_collections: { collection_id: string }[];
  product_tags: { tag_id: string }[];
  post_product_tags: { post_id: string }[];
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
  // Consumed once here (not inside the regularLocationQuantities initializer
  // below) so the same id can also decide whether to reopen the Inventory
  // sheet on return -- a seller who just created a location came here
  // specifically to enter its stock count, not to land back on the
  // collapsed product form.
  const [initialNewLocationId] = useState(() => takePendingNewLocationId());

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
    return initialNewLocationId && !(initialNewLocationId in base)
      ? { ...base, [initialNewLocationId]: 0 }
      : base;
  });
  // Gated on kind === "regular" -- a variant row's own Inventory sheet
  // shares this same location-creation side-trip, but has no top-level
  // sheet of its own to reopen into; without this check, returning from
  // creating a location while editing a variant product would pop open
  // this unrelated regular-product sheet on top of the variant form.
  const [inventorySheetOpen, setInventorySheetOpen] = useState(
    () => kind === "regular" && !!initialNewLocationId,
  );
  // Stock saved before per-location inventory existed has no location rows;
  // keep it so an unrelated edit + Save doesn't zero the product's stock.
  const [regularLegacyStockQty, setRegularLegacyStockQty] = useState(
    initialDraft?.regularLegacyStockQty ?? 0,
  );
  const regularStockQty = stockTotal({
    locationQuantities: regularLocationQuantities,
    legacyStockQty: regularLegacyStockQty,
  });
  // No UI edits materialFeel yet (mirrors "material" on the new-product
  // form) — round-tripped so opening an imported product and saving
  // doesn't drop it.
  const [regularBarcodes, setRegularBarcodes] = useState<BarcodeEntry[]>(
    initialDraft?.regularBarcodes ?? [],
  );
  const [regularMaterialFeel, setRegularMaterialFeel] = useState<string | null>(
    initialDraft?.regularMaterialFeel ?? null,
  );
  const [regularWeightGrams, setRegularWeightGrams] = useState<number | null>(
    initialDraft?.regularWeightGrams ?? null,
  );
  const [regularSku, setRegularSku] = useState(initialDraft?.regularSku ?? "");
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
    const rowSize = row.options.find((o) => normalizeOptionName(o.name) === "size")?.value;
    const rowMaterial = row.options.find((o) => normalizeOptionName(o.name) === "material")?.value;
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
  const [tagIds, setTagIds] = useState<string[]>(initialDraft?.tagIds ?? []);
  const [linkedPostIds, setLinkedPostIds] = useState<string[]>(initialDraft?.linkedPostIds ?? []);
  const [necessitiesSheetOpen, setNecessitiesSheetOpen] = useState(false);
  const [necessitiesWarningOpen, setNecessitiesWarningOpen] = useState(false);
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
           product_variants(id, sku, price, compare_at_price, cost_price, stock_qty, material, main_image_url, barcode, material_feel, weight_grams, additional_image_urls, continue_selling_out_of_stock, product_variant_options(variant_id, option_id, value_id), product_variant_stock(location_id, quantity), product_variant_barcodes(type, value, position)),
           product_options(id, name, position, product_option_values(id, value, position)),
           product_collections(collection_id),
           product_tags(tag_id),
           post_product_tags(post_id),
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

      // Falls back to the deprecated single-value column when the new table
      // has nothing for this variant -- an importer-written barcode (CSV,
      // Bumpa) only ever lands in that old column, never product_variant_
      // barcodes, so without this fallback opening and saving an imported
      // product would silently delete its barcode on the first edit.
      const toBarcodeEntries = (
        rows: { type: string; value: string; position: number }[],
        legacyBarcode: string | null,
      ): BarcodeEntry[] => {
        if (rows.length === 0) {
          return legacyBarcode?.trim() ? [{ type: "custom", value: legacyBarcode.trim() }] : [];
        }
        return [...rows]
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ type: toBarcodeType(r.type), value: r.value }));
      };

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
            barcodes: toBarcodeEntries(v.product_variant_barcodes, v.barcode),
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
        setRegularBarcodes(v ? toBarcodeEntries(v.product_variant_barcodes, v.barcode) : []);
        setRegularSku(v?.sku ?? "");
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
      setLinkedPostIds(product.post_product_tags.map((l) => l.post_id));

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
      regularSku,
      regularBarcodes,
      regularMaterialFeel,
      material,
      options,
      rows,
      collectionIds,
      sizeMeasurements,
      manualSize,
      tagIds,
      linkedPostIds,
      regularLegacyStockQty,
    };
  }

  // Baseline = the form exactly as it came out of the DB load (or out of a
  // restored draft). Anything identical to it is not "unsaved progress".
  const autosaveBaseline = useRef<string | null>(null);

  // Debounced localStorage autosave — the only thing that survives a hard
  // refresh. Guarded on `loading` so the still-fetching, mostly-blank form
  // doesn't overwrite a real autosave before the DB load has populated it.
  // Only writes once the form actually differs from that baseline: merely
  // opening a product must NOT leave a draft behind, otherwise the next open
  // would skip the DB fetch and show stale data with a bogus "restored"
  // banner. Back at baseline (undo, or save) means the draft is dropped.
  useEffect(() => {
    if (loading) return;
    const snapshot = JSON.stringify(currentDraft());
    if (autosaveBaseline.current === null) {
      autosaveBaseline.current = snapshot;
      return;
    }
    if (snapshot === autosaveBaseline.current) {
      clearAutosavedDraft(productId);
      return;
    }
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

  function handleSave() {
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

    // Necessities (including having picked a category at all, without
    // which there's nothing to check) don't block Save -- a seller can
    // always save, published or as a draft, missing details and all. This
    // is just a heads-up with a chance to go fix it first; "Link content"
    // is left out of what counts as missing while saving as a draft, since
    // it depends on a post/draft existing at all, which is outside this
    // form's control (see allNecessitiesFilled).
    const hasCategory = categoryPath.length > 0;
    const necessitiesOk =
      hasCategory &&
      allNecessitiesFilled(
        categoryPath,
        kind,
        options,
        material,
        sizeMeasurements,
        manualSize,
        rows,
        regularWeightGrams,
        linkedPostIds,
        status,
      );
    if (!necessitiesOk) {
      setError("");
      setNecessitiesWarningOpen(true);
      return;
    }

    performSave();
  }

  function performSave() {
    setSaving(true);
    setError("");

    // Fired without awaiting: this used to block the whole page until every
    // update/delete/insert finished (a dozen+ sequential round trips for a
    // variant product), leaving the seller stuck here with nothing to do.
    // startProductSave runs the write sequence in the background and reports
    // progress/errors via ProductSaveToast, so navigating away immediately
    // is safe.
    startProductSave({
      mode: "update",
      productId,
      storeId: storeId!,
      title,
      descriptionShort,
      categoryName: categoryPath.at(-1)?.name || null,
      status,
      manualSize,
      kind,
      price,
      compareAtPrice,
      costPrice,
      material,
      regularContinueSellingOutOfStock,
      regularLocationQuantities,
      regularLegacyStockQty,
      regularWeightGrams,
      regularSku,
      regularBarcodes,
      regularMaterialFeel,
      mainImageUrl,
      regularAdditionalImageUrls,
      options,
      rows,
      sizeMeasurements,
      collectionIds,
      tagIds,
      linkedPostIds,
    });
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
            sku: regularSku,
            barcodes: regularBarcodes,
          }}
          initialLocationsPickerOpen={!!initialNewLocationId}
          onCreateLocation={handleCreateLocation}
          onSave={(values: InventoryValues) => {
            setRegularContinueSellingOutOfStock(values.continueSellingOutOfStock);
            setRegularLocationQuantities(values.locationQuantities);
            setRegularSku(values.sku);
            setRegularBarcodes(values.barcodes);
            setInventorySheetOpen(false);
          }}
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
          onChangeMaterial={setMaterial}
          sizeMeasurements={sizeMeasurements}
          onChangeSizeMeasurements={setSizeMeasurements}
          manualSize={manualSize}
          onChangeManualSize={setManualSize}
          rows={rows}
          regularWeightGrams={regularWeightGrams}
          regularWeightEstimate={regularWeightEstimate}
          onChangeRegularWeightGrams={setRegularWeightGrams}
          linkedPostIds={linkedPostIds}
          onChangeLinkedPostIds={setLinkedPostIds}
          onClose={() => setNecessitiesSheetOpen(false)}
        />
      )}

      {necessitiesWarningOpen && (
        <NecessitiesWarningDialog
          reviewLabel={categoryPath.length === 0 ? "Pick a category" : "Review necessities"}
          onReview={() => {
            setNecessitiesWarningOpen(false);
            if (categoryPath.length === 0) setCategoryPickerOpen(true);
            else setNecessitiesSheetOpen(true);
          }}
          onSaveAnyway={() => {
            setNecessitiesWarningOpen(false);
            performSave();
          }}
          onCancel={() => setNecessitiesWarningOpen(false)}
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
