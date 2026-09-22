import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronRight, Tag, Hash, ListChecks } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { startProductSave } from "@/lib/product-save";
import { hasPendingUploads } from "@/lib/background-upload";
import { CategoryNode } from "@/lib/categories";
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
import {
  VariantMatrixBuilder,
  VariantOption,
  VariantRow,
} from "@/components/product-form/VariantMatrixBuilder";
import { ManualSize, SizeMeasurements, getSizeChartForCategory } from "@/lib/size-chart-config";
import type { BarcodeEntry } from "@/lib/barcode-types";
import { estimateWeight, type WeightEstimate } from "@/lib/weight-estimate";
import { preloadGuideImage } from "@/components/product-form/size-chart/guide-images";
import {
  stashProductDraft,
  takeProductDraft,
  takePendingNewCollectionId,
  takePendingNewLocationId,
  takePendingVariantInventoryContext,
  setPendingVariantInventoryContext,
  type VariantInventoryContext,
  readAutosavedDraft,
  writeAutosavedDraft,
  clearAutosavedDraft,
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

function NewProduct() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();
  const { kind: intentKind } = Route.useSearch();

  // Two sources of "come back to where I was," checked in order: a draft
  // stashed just before a side-trip to create a collection/location (see
  // handleCreateCollection below) always wins since it's the most recent
  // state; otherwise fall back to the autosaved draft from localStorage,
  // which is what survives an actual page refresh. Read once via lazy
  // initializers so every field seeds correctly on the very first render.
  const [handoffDraft] = useState(() => takeProductDraft());
  const [restoredFromAutosave] = useState(() => !handoffDraft && !!readAutosavedDraft(undefined));
  const [initialDraft] = useState(() => handoffDraft ?? readAutosavedDraft(undefined));
  const [initialNewCollectionId] = useState(() => takePendingNewCollectionId());
  // Consumed once here (not inside the regularLocationQuantities initializer
  // below) so the same id can also decide whether to reopen the Inventory
  // sheet on return -- a seller who just created a location came here
  // specifically to enter its stock count, not to land back on the
  // collapsed product form.
  const [initialNewLocationId] = useState(() => takePendingNewLocationId());
  // Which variant-wizard Inventory sheet (a specific row, or the bulk "Apply
  // to all" one) sent the seller off to create this location, if any -- see
  // VariantInventoryContext. Has a real setter (not the usual bare useState)
  // so it can be cleared once the wizard has consumed it -- otherwise
  // VariantCombinationsSheet re-reads this same non-null value every time it
  // remounts later in this same page session (leaving the Variants step and
  // re-entering it, say) and keeps popping its Inventory sheet back open
  // forever. Cleared via VariantMatrixBuilder's own
  // onInventoryContextConsumed callback (fired from ITS mount effect), not a
  // plain effect here -- VariantMatrixBuilder only renders once storeId
  // resolves (see useActiveStoreId, an async effect of its own), so a
  // `useEffect(..., [])` at this level would fire on THIS component's first
  // commit, well before that child -- and the grandchild that actually reads
  // this value -- ever mounts, clearing it before anything downstream had a
  // chance to see it.
  const [initialVariantInventoryContext, setInitialVariantInventoryContext] = useState(() =>
    takePendingVariantInventoryContext(),
  );

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

  // Reused both to kick off the guide-image preload below and to pick which
  // weight-estimate formula applies (see weight-estimate.ts) — stable across
  // renders for the same category since CHARTS_BY_CATEGORY always returns
  // the same object reference.
  const chart = getSizeChartForCategory(categoryPath);

  // Kick off the size-chart guide image fetch the moment a category is
  // picked, so it's already cached by the time the seller opens Necessities.
  useEffect(() => {
    if (chart) preloadGuideImage(chart.guide);
  }, [chart]);

  // Regular-mode state
  const [price, setPrice] = useState(initialDraft?.price ?? "");
  // Product-level pricing policy: when true the price fields above mean "what
  // I want to receive" and product-save grosses them up before writing.
  const [passFeesToBuyer, setPassFeesToBuyer] = useState(initialDraft?.passFeesToBuyer ?? false);
  const [compareAtPrice, setCompareAtPrice] = useState(initialDraft?.compareAtPrice ?? "");
  const [costPrice, setCostPrice] = useState(initialDraft?.costPrice ?? "");
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
  const regularStockQty = Object.values(regularLocationQuantities).reduce((sum, n) => sum + n, 0);
  // Filled in via Necessities (MaterialSheet) for a regular product; a
  // variant product's Material lives as an option axis instead.
  const [material, setMaterial] = useState(initialDraft?.material ?? "");
  const [regularWeightGrams, setRegularWeightGrams] = useState<number | null>(
    initialDraft?.regularWeightGrams ?? null,
  );
  const [regularSku, setRegularSku] = useState(initialDraft?.regularSku ?? "");
  // Never surfaced anywhere on this page before now -- new products start
  // with none, unlike the edit page's regularBarcodes which round-trips
  // values an import may have set.
  const [regularBarcodes, setRegularBarcodes] = useState<BarcodeEntry[]>(
    initialDraft?.regularBarcodes ?? [],
  );

  // Variant-mode state
  const [options, setOptions] = useState<VariantOption[]>(initialDraft?.options ?? []);
  // Pre-checks the just-created location (at 0 qty, same as the regular-
  // product path above) on the one row whose Inventory sheet sent the seller
  // to create it -- so returning lands with it already picked, not just
  // present in the list next time Edit Locations happens to be reopened.
  const [rows, setRows] = useState<VariantRow[]>(() => {
    const base = initialDraft?.rows ?? [];
    if (initialVariantInventoryContext?.kind !== "row" || !initialNewLocationId) return base;
    return base.map((r) =>
      r.key === initialVariantInventoryContext.rowKey &&
      !(initialNewLocationId in r.locationQuantities)
        ? { ...r, locationQuantities: { ...r.locationQuantities, [initialNewLocationId]: 0 } }
        : r,
    );
  });
  const [sizeMeasurements, setSizeMeasurements] = useState<SizeMeasurements>(
    initialDraft?.sizeMeasurements ?? {},
  );
  // Manual size pick — only meaningful when there's no Variant Size axis
  // (regular products, or variant products that only vary by e.g. Color).
  const [manualSize, setManualSize] = useState<ManualSize | null>(initialDraft?.manualSize ?? null);

  // A regular product has no Variant Size axis, so its own measurements (if
  // any were picked via the size chart) live under manualSize's value.
  const regularWeightEstimate = estimateWeight(
    chart,
    sizeMeasurements[manualSize?.value ?? ""] ?? {},
    material,
  );

  // Per-row suggestion for the variant matrix: prefer the row's own Size/
  // Material option values over the shared manualSize/material fallback,
  // since a variant product's rows can each be a different size or fabric.
  // Material is checked in three places, most-specific first: a real Material
  // option axis, then the row's own `material` column -- which is where the
  // Necessities picker writes for a variant product, since the product-level
  // `material` below is never persisted for one (see product-form/CLAUDE.md).
  // Missing that middle case meant the estimate button silently never showed
  // up for a seller who answered Material on the checklist.
  function estimateWeightForRow(row: VariantRow): WeightEstimate {
    const rowSize = row.options.find((o) => normalizeOptionName(o.name) === "size")?.value;
    const axisMaterial = row.options.find((o) => normalizeOptionName(o.name) === "material")?.value;
    const rowMaterial = axisMaterial?.trim() || row.material?.trim() || material;
    const measurements = sizeMeasurements[rowSize ?? manualSize?.value ?? ""] ?? {};
    return estimateWeight(chart, measurements, rowMaterial);
  }

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
  const [tagIds, setTagIds] = useState<string[]>(initialDraft?.tagIds ?? []);
  const [linkedPostIds, setLinkedPostIds] = useState<string[]>(initialDraft?.linkedPostIds ?? []);
  const [necessitiesSheetOpen, setNecessitiesSheetOpen] = useState(false);
  const [necessitiesWarningOpen, setNecessitiesWarningOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showRestoredBanner, setShowRestoredBanner] = useState(restoredFromAutosave);

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  // Shared by both side-trips below — a seller can leave this form to create
  // a collection or a pickup location mid-listing, and either way needs the
  // whole draft stashed so nothing typed so far is lost on return.
  function currentDraft() {
    return {
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
      regularContinueSellingOutOfStock,
      regularLocationQuantities,
      regularWeightGrams,
      regularSku,
      regularBarcodes,
      material,
      options,
      rows,
      collectionIds,
      sizeMeasurements,
      manualSize,
      tagIds,
      linkedPostIds,
    };
  }

  // Debounced localStorage autosave — the only thing that survives a hard
  // refresh (currentDraft's module-variable stash above only survives
  // client-side navigation). JSON.stringify as the dep is deliberate: it's
  // the simplest way to react to "any field actually changed" without
  // listing every piece of state that feeds currentDraft() by hand.
  useEffect(() => {
    const t = setTimeout(() => writeAutosavedDraft(undefined, currentDraft()), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(currentDraft())]);

  // Backstop for hasPendingUploads() below, same reasoning as product-
  // save.ts's hasBlobImageUrl: that only reports uploads still IN FLIGHT, so
  // a photo whose upload already failed (or got dismissed from the toast)
  // has fallen out of it while its object-URL preview is still sitting in
  // one of these fields -- stashProductDraft would freeze that dead blob:
  // url into the draft with no upload left anywhere to ever patch it.
  function hasBlobImagePending() {
    if (mainImageUrl.startsWith("blob:")) return true;
    if (additionalImageUrls.some((u) => u.startsWith("blob:"))) return true;
    return rows.some(
      (r) =>
        r.mainImageUrl.startsWith("blob:") ||
        (r.additionalImageUrls ?? []).some((u) => u.startsWith("blob:")),
    );
  }

  // A page-level error banner would be invisible here -- this is reachable
  // from inside the (also full-screen) Collections sheet, which is stacked
  // on top of it. alert() is the one thing guaranteed to surface regardless
  // of how many sheets deep the tap that triggered it was.
  function handleCreateCollection() {
    if (hasPendingUploads() || hasBlobImagePending()) {
      alert("Wait for your photos to finish uploading before doing that");
      return;
    }
    stashProductDraft(currentDraft());
    navigate({ to: "/store/collections/new" });
  }

  // `context` is only passed from inside the variant wizard (a specific
  // row's Inventory sheet, or the bulk "Apply to all" one) -- the regular
  // product's own Inventory sheet calls this with `pendingRegular` instead.
  // Reachable from as deep as Variants -> Inventory -> Edit locations, so
  // same alert() reasoning as handleCreateCollection above.
  //
  // Both `context.pending` (variant row) and `pendingRegular` (regular
  // product) exist because whatever the seller already toggled/checked in
  // that still-open Inventory sheet only reaches this page's own state via
  // that sheet's OWN Save button -- which hasn't fired yet here. Folding it
  // into the stashed draft directly (rather than relying on a setRows/
  // setRegular* call landing before this reads state) is required: both
  // happen inside the same synchronous click, and React doesn't apply a
  // state update to this render's closure until after it returns.
  function handleCreateLocation(
    context?: VariantInventoryContext,
    pendingRegular?: InventoryValues,
  ) {
    if (hasPendingUploads() || hasBlobImagePending()) {
      alert("Wait for your photos to finish uploading before doing that");
      return;
    }
    if (context) setPendingVariantInventoryContext(context);
    const draft = currentDraft();
    if (context?.kind === "row") {
      draft.rows = draft.rows.map((r) =>
        r.key === context.rowKey ? { ...r, ...context.pending } : r,
      );
    } else if (pendingRegular) {
      draft.regularContinueSellingOutOfStock = pendingRegular.continueSellingOutOfStock;
      draft.regularLocationQuantities = pendingRegular.locationQuantities;
      draft.regularSku = pendingRegular.sku;
      draft.regularBarcodes = pendingRegular.barcodes;
    }
    stashProductDraft(draft);
    navigate({ to: "/store/locations/new" });
  }

  // Sellers can uncheck combinations they don't stock — only these get written.
  const selectedRows = rows.filter((r) => r.selected);

  function handleTypeSwitch(next: ProductKind) {
    setTypeSwitchOpen(false);
    setKind(next);
    // Keep the URL's ?kind in sync with the in-page switch -- otherwise a
    // refresh re-reads the stale value from the initial navigation (e.g. the
    // CreateProductTypeModal pick) and silently reverts the switch.
    navigate({ to: ".", search: (prev) => ({ ...prev, kind: next }), replace: true });
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

    // A still-uploading photo's field currently holds an object-URL preview
    // (see MediaSection/VariantCombinationsSheet's background-upload use) --
    // saving now would write that blob: url straight into the database
    // instead of the real one, permanently broken the moment this tab closes.
    if (hasPendingUploads()) {
      setError("Wait for your photos to finish uploading before saving");
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
    // insert finished (several seconds for a variant product), leaving the
    // seller stuck here with nothing to do. startProductSave runs the write
    // sequence in the background and reports progress/errors via
    // ProductSaveToast, so navigating away immediately is safe.
    startProductSave({
      mode: "create",
      storeId: storeId!,
      title,
      descriptionShort,
      categoryName: categoryPath.at(-1)?.name || null,
      status,
      manualSize,
      kind,
      passFeesToBuyer,
      price,
      compareAtPrice,
      costPrice,
      material,
      regularContinueSellingOutOfStock,
      regularLocationQuantities,
      regularWeightGrams,
      regularSku,
      regularBarcodes,
      regularMaterialFeel: null,
      mainImageUrl,
      regularAdditionalImageUrls: additionalImageUrls,
      options,
      rows,
      sizeMeasurements,
      collectionIds,
      tagIds,
      linkedPostIds,
    });
    // Cleared here, synchronously, not left to product-save.ts's own
    // deferred clearAutosavedDraft (which only runs once the background
    // create's real DB writes finish -- seconds away for a variant product).
    // Save is treated as committed the instant we navigate away below, so
    // the "new" autosave slot has to be wiped in that same instant too --
    // otherwise tapping + again to start a genuinely new product, before
    // that background write resolves, restored the JUST-SAVED product's
    // data into what should have been a blank form.
    clearAutosavedDraft(undefined);
    navigate({ to: "/store/products" });
  }

  return (
    <div className="min-h-dvh bg-sd-surface pb-10">
      <div className="sticky top-14 z-20 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <BackButton
          icon="chevron"
          size={18}
          label="Cancel"
          ariaLabel="Cancel"
          className="text-sm text-sd-ink-muted flex items-center gap-0.5 -ml-1"
        />
        <button
          onClick={() => setTypeSwitchOpen(true)}
          type="button"
          className="text-sm font-medium text-sd-ink flex items-center gap-1"
        >
          {kind === "regular" ? "Regular product" : "Product with variations"}
          <ChevronDown size={14} className="text-sd-ink-faint" />
        </button>
      </div>

      {showRestoredBanner && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-sd-elevated px-3 py-2.5">
          <p className="text-xs text-sd-ink-muted">
            Restored your unsaved progress from last time.
          </p>
          <button
            type="button"
            onClick={() => setShowRestoredBanner(false)}
            className="text-xs font-medium text-sd-ink shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

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
            additionalImageUrls={additionalImageUrls}
            passFeesToBuyer={passFeesToBuyer}
            onChangePassFeesToBuyer={setPassFeesToBuyer}
            storeId={storeId}
            onCreateLocation={handleCreateLocation}
            estimateWeightForRow={estimateWeightForRow}
            initialInventoryContext={initialVariantInventoryContext}
            initialNewLocationId={initialNewLocationId}
            onInventoryContextConsumed={() => setInitialVariantInventoryContext(null)}
          />
        )
      )}

      {/* initialNewCollectionId has two different producers, and only one of
          them should hide this row. A collection's own "Add products" ->
          "Create new" (store.collections_.$id.tsx) sends the seller straight
          here with a pending id and NO stashed draft -- there was nothing to
          stash yet, this is a brand-new page load -- and the product really
          is scoped to that one collection, so a picker for every *other*
          collection here would just invite drift. Using the "create new
          collection" shortcut FROM INSIDE this page's own Collections sheet
          (handleCreateCollection, below) sets the exact same pending id, but
          always stashes a draft first -- handoffDraft is how the two are
          told apart. Hiding the row in that second case (as an earlier
          version of this guard did, unconditionally) made the row the seller
          was just using vanish the moment they came back. */}
      {!(initialNewCollectionId && !handoffDraft) && (
        <button
          type="button"
          onClick={() => setCollectionsSheetOpen(true)}
          className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-sd-line/50 text-left"
        >
          <span className="flex items-center gap-3 text-[15px] text-sd-ink">
            <Tag size={18} className="text-sd-ink-faint" />
            Collections
          </span>
          <span className="flex items-center gap-2">
            {collectionIds.length > 0 && (
              <span className="text-xs text-sd-ink-faint">{collectionIds.length} selected</span>
            )}
            <ChevronRight size={16} className="text-sd-ink-faint" />
          </span>
        </button>
      )}
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
          passFeesToBuyer={passFeesToBuyer}
          onChangePassFeesToBuyer={setPassFeesToBuyer}
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
          onCreateLocation={(current) => handleCreateLocation(undefined, current)}
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
          onChangeOptions={setOptions}
          material={material}
          onChangeMaterial={setMaterial}
          sizeMeasurements={sizeMeasurements}
          onChangeSizeMeasurements={setSizeMeasurements}
          manualSize={manualSize}
          onChangeManualSize={setManualSize}
          rows={rows}
          onChangeRows={setRows}
          estimateWeightForRow={estimateWeightForRow}
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

      <div className="px-4 py-5 border-b-8 border-sd-line/50">
        <p className="text-[15px] font-semibold text-sd-ink mb-3">Product Status</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStatus("active")}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface ${
              status === "active"
                ? "border-sd-ink bg-sd-elevated text-sd-ink"
                : "border-sd-line text-sd-ink-muted"
            }`}
          >
            Published
          </button>
          <button
            type="button"
            onClick={() => setStatus("draft")}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface ${
              status === "draft"
                ? "border-sd-ink bg-sd-elevated text-sd-ink"
                : "border-sd-line text-sd-ink-muted"
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
          className="w-full bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-4 disabled:opacity-50 oak-motion-control active:scale-[0.98]"
        >
          {saving ? "Saving…" : "Save Product"}
        </button>
      </div>
    </div>
  );
}
