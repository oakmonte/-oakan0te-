import { supabase } from "@/lib/integrations/my-supabase/client";
import { grossUpForNet } from "@/lib/pricing-fees";
import { clearAutosavedDraft } from "@/lib/product-draft-handoff";
import { stockTotal } from "@/components/product-form/variant-stock";
import type { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import type { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";
import type { BarcodeEntry } from "@/lib/barcode-types";
import { computeIsComplete, type CompletenessInput } from "@/lib/product-completeness";

// Saving a product used to block its form page until every insert/update
// finished — a variant product alone is 8+ sequential round trips (options,
// values, variants, links, stock, measurements, collections, tags), which on
// a slow connection left the seller stuck staring at "Saving…" for seconds
// with nothing else to do. This runs the whole write sequence in the
// background instead: the caller validates, fires startProductSave, and
// navigates away immediately, and ProductSaveToast (mounted once in
// __root.tsx) shows progress/errors regardless of what route the seller's on
// when it settles. Plain module state, not React state — same "survives
// navigation" reasoning as post-upload.ts — and there's only ever one product
// save in flight at a time since a seller only has one product form open at
// once.
export type ProductSaveState =
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string }
  | null;

export type ProductSavePayload = {
  storeId: string;
  title: string;
  descriptionShort: string;
  // Precomputed by the caller (categoryPath.at(-1)?.name || null) so this
  // module doesn't need to import CategoryNode / walk the category tree.
  categoryName: string | null;
  status: "draft" | "active";
  manualSize: ManualSize | null;
  kind: "regular" | "variant";
  // Whether the seller passes the transaction fees on to the customer. When
  // true, the price strings in this payload are what the seller wants to
  // RECEIVE, and the grossed-up charge is what gets written — see
  // chargedPrice below.
  passFeesToBuyer: boolean;
  // Regular-mode fields
  price: string;
  compareAtPrice: string;
  costPrice: string;
  material: string;
  regularContinueSellingOutOfStock: boolean;
  regularLocationQuantities: Record<string, number>;
  // Only ever set on the edit page — a brand new product has no legacy,
  // location-less stock to preserve.
  regularLegacyStockQty?: number;
  regularWeightGrams: number | null;
  regularSku: string;
  // One-to-many now (see product_variant_barcodes) -- replaces the old
  // single barcode column, which the app no longer reads or writes.
  regularBarcodes: BarcodeEntry[];
  // Only the edit page has UI for this; the new-product page always passes
  // null, matching create's existing behaviour of never writing this column.
  regularMaterialFeel: string | null;
  mainImageUrl: string;
  regularAdditionalImageUrls: string[] | null;
  // Variant-mode fields
  options: VariantOption[];
  rows: VariantRow[];
  sizeMeasurements: SizeMeasurements;
  collectionIds: string[];
  tagIds: string[];
  // Posts/drafts this product is tagged in. Writes to post_product_tags —
  // the same table LinkProductsSheet.tsx (the post-side "link products"
  // sheet) reads and writes — so a link made from either side shows up
  // immediately on the other.
  linkedPostIds: string[];
} & ({ mode: "create" } | { mode: "update"; productId: string });

let state: ProductSaveState = null;
let pendingPayload: ProductSavePayload | null = null;
// Whether the pending save began life as a create. A retry after a PARTIAL
// create runs as an update (see run()), so `pendingPayload.mode` stops being
// the answer to "was this a new product?" — and the autosaved draft to clear
// on success is still the new-product one, keyed undefined rather than by id.
let pendingStartedAsCreate = false;
const listeners = new Set<() => void>();

function setState(next: ProductSaveState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeProductSave(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProductSaveSnapshot(): ProductSaveState {
  return state;
}

function barcodeInsertRows(variantId: string, entries: BarcodeEntry[]) {
  return entries
    .filter((b) => b.value.trim().length > 0)
    .map((b, i) => ({ variant_id: variantId, type: b.type, value: b.value.trim(), position: i }));
}

async function insertBarcodes(rows: ReturnType<typeof barcodeInsertRows>) {
  if (rows.length === 0) return;
  const res = await supabase.from("product_variant_barcodes").insert(rows);
  if (res.error) throw new Error(`product_variant_barcodes: ${res.error.message}`);
}

/** What the customer is charged, which is what product_variants.price holds.
 *
 *  The column always means "what the buyer pays", so every consumer — feed,
 *  storefront, cart, exports — reads one number and needs to know nothing
 *  about fee policy. The conversion therefore happens here, at the single
 *  write boundary, rather than being repeated at each of the four insert
 *  sites or pushed onto readers.
 */
function chargedPrice(entered: string, passFeesToBuyer: boolean): number {
  const value = Number(entered);
  return passFeesToBuyer ? grossUpForNet(value) : value;
}

/** Maps a save payload onto the shared completeness rule.
 *
 *  Kept next to the writers rather than inside product-completeness.ts so
 *  that module stays free of this app's payload shape and can be mirrored
 *  verbatim into the import worker, which has a different one.
 *
 *  A variant product is judged on its SELECTED rows only — an unchecked
 *  combination is never written as a variant, so an unpriced one can't make
 *  the product unlistable. Regular products fall back to the product-level
 *  main image, matching what the variant rows themselves do above.
 */
function completenessInput(payload: ProductSavePayload): CompletenessInput {
  if (payload.kind === "regular") {
    return {
      title: payload.title,
      variants: [
        {
          price: payload.price.trim() ? Number(payload.price) : null,
          mainImageUrl: payload.mainImageUrl,
          weightGrams: payload.regularWeightGrams,
        },
      ],
    };
  }
  return {
    title: payload.title,
    variants: payload.rows
      .filter((r) => r.selected)
      .map((r) => ({
        price: r.price.trim() ? Number(r.price) : null,
        mainImageUrl: r.mainImageUrl.trim() || payload.mainImageUrl,
        weightGrams: r.weightGrams ?? null,
      })),
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

async function runCreate(
  payload: ProductSavePayload,
  /** Called the instant the `products` row exists, before any child table is
   *  touched. Everything after that point is retryable against the row rather
   *  than by making a second one. */
  onProductCreated: (productId: string) => void,
) {
  const selectedRows = payload.rows.filter((r) => r.selected);

  const { data: product, error: productErr } = await supabase
    .from("products")
    .insert({
      store_id: payload.storeId,
      handle: slugify(payload.title),
      title: payload.title.trim(),
      description_short: payload.descriptionShort.trim() || null,
      product_type: payload.categoryName || null,
      status: payload.status,
      source_platform: "manual",
      is_complete: computeIsComplete(completenessInput(payload)),
      pass_fees_to_buyer: payload.passFeesToBuyer,
      manual_size_value: payload.manualSize?.value ?? null,
      manual_size_system: payload.manualSize?.system ?? null,
    })
    .select("id")
    .single();

  if (productErr || !product) throw new Error(productErr?.message ?? "Failed to create product");

  onProductCreated(product.id);

  if (payload.kind === "regular") {
    const regularStockQty = stockTotal({
      locationQuantities: payload.regularLocationQuantities,
      legacyStockQty: payload.regularLegacyStockQty,
    });
    const { data: variant, error: variantErr } = await supabase
      .from("product_variants")
      .insert({
        product_id: product.id,
        price: chargedPrice(payload.price, payload.passFeesToBuyer),
        compare_at_price: payload.compareAtPrice ? Number(payload.compareAtPrice) : null,
        cost_price: payload.costPrice ? Number(payload.costPrice) : null,
        stock_qty: regularStockQty,
        continue_selling_out_of_stock: payload.regularContinueSellingOutOfStock,
        material: payload.material.trim() || null,
        weight_grams: payload.regularWeightGrams,
        sku: payload.regularSku.trim() || null,
        main_image_url: payload.mainImageUrl.trim() || null,
        additional_image_urls:
          payload.regularAdditionalImageUrls && payload.regularAdditionalImageUrls.length > 0
            ? payload.regularAdditionalImageUrls
            : null,
      })
      .select("id")
      .single();
    if (variantErr || !variant)
      throw new Error(variantErr?.message ?? "Failed to create product variant");

    await insertBarcodes(barcodeInsertRows(variant.id, payload.regularBarcodes));

    const stockPayload = Object.entries(payload.regularLocationQuantities).map(
      ([locationId, quantity]) => ({ variant_id: variant.id, location_id: locationId, quantity }),
    );
    if (stockPayload.length > 0) {
      const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
      if (stockRes.error) throw new Error(`product_variant_stock: ${stockRes.error.message}`);
    }
  } else {
    const usableOptions = payload.options.filter((o) => o.name.trim() && o.values.length > 0);

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
      price: chargedPrice(r.price, payload.passFeesToBuyer),
      compare_at_price: r.compareAtPrice ? Number(r.compareAtPrice) : null,
      cost_price: r.costPrice ? Number(r.costPrice) : null,
      stock_qty: stockTotal(r),
      sku: r.sku.trim() || null,
      continue_selling_out_of_stock: r.continueSellingOutOfStock,
      weight_grams: r.weightGrams ?? null,
      main_image_url: r.mainImageUrl.trim() || payload.mainImageUrl.trim() || null,
      material: r.material ?? null,
      material_feel: r.materialFeel ?? null,
      additional_image_urls: r.additionalImageUrls ?? null,
    }));

    const barcodeRows = selectedRows.flatMap((r, ri) =>
      barcodeInsertRows(variantsPayload[ri].id, r.barcodes ?? []),
    );

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
    if (optionsRes.error) throw new Error(`product_options: ${optionsRes.error.message}`);

    const valuesRes = await supabase.from("product_option_values").insert(valuesPayload);
    if (valuesRes.error) throw new Error(`product_option_values: ${valuesRes.error.message}`);

    const variantsRes = await supabase.from("product_variants").insert(variantsPayload);
    if (variantsRes.error) throw new Error(`product_variants: ${variantsRes.error.message}`);

    const linksRes = await supabase.from("product_variant_options").insert(linksPayload);
    if (linksRes.error) throw new Error(`product_variant_options: ${linksRes.error.message}`);

    if (stockPayload.length > 0) {
      const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
      if (stockRes.error) throw new Error(`product_variant_stock: ${stockRes.error.message}`);
    }

    await insertBarcodes(barcodeRows);
  }

  // Not kind-gated: a regular product (or a variant product with no Size
  // axis) can still have measurements against its manually-picked size.
  const measurementsPayload = Object.entries(payload.sizeMeasurements).flatMap(
    ([sizeValue, byKey]) =>
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
      throw new Error(`product_size_measurements: ${measurementsRes.error.message}`);
  }

  if (payload.collectionIds.length > 0) {
    const { error: collectionsErr } = await supabase.from("product_collections").insert(
      payload.collectionIds.map((collectionId) => ({
        product_id: product.id,
        collection_id: collectionId,
      })),
    );
    if (collectionsErr) throw new Error(`product_collections: ${collectionsErr.message}`);
  }

  if (payload.tagIds.length > 0) {
    const { error: tagsErr } = await supabase.from("product_tags").insert(
      payload.tagIds.map((tagId) => ({
        product_id: product.id,
        tag_id: tagId,
      })),
    );
    if (tagsErr) throw new Error(`product_tags: ${tagsErr.message}`);
  }

  if (payload.linkedPostIds.length > 0) {
    const { error: linksErr } = await supabase.from("post_product_tags").insert(
      payload.linkedPostIds.map((postId) => ({
        product_id: product.id,
        post_id: postId,
      })),
    );
    if (linksErr) throw new Error(`post_product_tags: ${linksErr.message}`);
  }
}

async function runUpdate(payload: Extract<ProductSavePayload, { mode: "update" }>) {
  const productId = payload.productId;
  const selectedRows = payload.rows.filter((r) => r.selected);

  const { error: productErr } = await supabase
    .from("products")
    .update({
      title: payload.title.trim(),
      description_short: payload.descriptionShort.trim() || null,
      product_type: payload.categoryName || null,
      status: payload.status,
      is_complete: computeIsComplete(completenessInput(payload)),
      pass_fees_to_buyer: payload.passFeesToBuyer,
      manual_size_value: payload.manualSize?.value ?? null,
      manual_size_system: payload.manualSize?.system ?? null,
    })
    // handle, source_platform, external_handle and category_id are
    // deliberately left out of this payload: handle is the public slug (a
    // seller renaming the title must not change their product's URL), and
    // the rest are provenance an edit here shouldn't touch.
    .eq("id", productId);
  if (productErr) throw new Error(productErr.message);

  // Rebuild children from scratch rather than diffing them by id — same
  // choice execute.js makes for imports, for the same reason: diffing
  // sounds better until a seller renames or removes an option, at which
  // point it silently strands the old rows. product_variants cascades
  // product_variant_options; product_options cascades product_option_values.
  const variantsDel = await supabase.from("product_variants").delete().eq("product_id", productId);
  if (variantsDel.error) throw new Error(`product_variants: ${variantsDel.error.message}`);
  const optionsDel = await supabase.from("product_options").delete().eq("product_id", productId);
  if (optionsDel.error) throw new Error(`product_options: ${optionsDel.error.message}`);

  if (payload.kind === "regular") {
    const regularStockQty = stockTotal({
      locationQuantities: payload.regularLocationQuantities,
      legacyStockQty: payload.regularLegacyStockQty,
    });
    const { data: variant, error: variantErr } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        price: chargedPrice(payload.price, payload.passFeesToBuyer),
        compare_at_price: payload.compareAtPrice ? Number(payload.compareAtPrice) : null,
        cost_price: payload.costPrice ? Number(payload.costPrice) : null,
        stock_qty: regularStockQty,
        material: payload.material.trim() || null,
        main_image_url: payload.mainImageUrl.trim() || null,
        sku: payload.regularSku.trim() || null,
        continue_selling_out_of_stock: payload.regularContinueSellingOutOfStock,
        material_feel: payload.regularMaterialFeel,
        weight_grams: payload.regularWeightGrams,
        additional_image_urls: payload.regularAdditionalImageUrls,
      })
      .select("id")
      .single();
    if (variantErr || !variant)
      throw new Error(`product_variants: ${variantErr?.message ?? "insert failed"}`);

    const stockPayload = Object.entries(payload.regularLocationQuantities).map(
      ([locationId, quantity]) => ({ variant_id: variant.id, location_id: locationId, quantity }),
    );
    if (stockPayload.length > 0) {
      const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
      if (stockRes.error) throw new Error(`product_variant_stock: ${stockRes.error.message}`);
    }

    await insertBarcodes(barcodeInsertRows(variant.id, payload.regularBarcodes));
  } else {
    const usableOptions = payload.options.filter((o) => o.name.trim() && o.values.length > 0);

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
      price: chargedPrice(r.price, payload.passFeesToBuyer),
      compare_at_price: r.compareAtPrice ? Number(r.compareAtPrice) : null,
      cost_price: r.costPrice ? Number(r.costPrice) : null,
      stock_qty: stockTotal(r),
      sku: r.sku.trim() || null,
      continue_selling_out_of_stock: r.continueSellingOutOfStock,
      main_image_url: r.mainImageUrl.trim() || payload.mainImageUrl.trim() || null,
      material: r.material ?? null,
      material_feel: r.materialFeel ?? null,
      weight_grams: r.weightGrams ?? null,
      additional_image_urls: r.additionalImageUrls ?? null,
    }));

    const barcodeRows = selectedRows.flatMap((r, ri) =>
      barcodeInsertRows(variantsPayload[ri].id, r.barcodes ?? []),
    );

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
    if (optionsRes.error) throw new Error(`product_options: ${optionsRes.error.message}`);

    const valuesRes = await supabase.from("product_option_values").insert(valuesPayload);
    if (valuesRes.error) throw new Error(`product_option_values: ${valuesRes.error.message}`);

    const variantsRes = await supabase.from("product_variants").insert(variantsPayload);
    if (variantsRes.error) throw new Error(`product_variants: ${variantsRes.error.message}`);

    const linksRes = await supabase.from("product_variant_options").insert(linksPayload);
    if (linksRes.error) throw new Error(`product_variant_options: ${linksRes.error.message}`);

    if (stockPayload.length > 0) {
      const stockRes = await supabase.from("product_variant_stock").insert(stockPayload);
      if (stockRes.error) throw new Error(`product_variant_stock: ${stockRes.error.message}`);
    }

    await insertBarcodes(barcodeRows);
  }

  const measurementsDel = await supabase
    .from("product_size_measurements")
    .delete()
    .eq("product_id", productId);
  if (measurementsDel.error)
    throw new Error(`product_size_measurements: ${measurementsDel.error.message}`);

  const measurementsPayload = Object.entries(payload.sizeMeasurements).flatMap(
    ([sizeValue, byKey]) =>
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
      throw new Error(`product_size_measurements: ${measurementsRes.error.message}`);
  }

  const collectionsDel = await supabase
    .from("product_collections")
    .delete()
    .eq("product_id", productId);
  if (collectionsDel.error) throw new Error(`product_collections: ${collectionsDel.error.message}`);
  if (payload.collectionIds.length > 0) {
    const { error: collectionsErr } = await supabase.from("product_collections").insert(
      payload.collectionIds.map((collectionId) => ({
        product_id: productId,
        collection_id: collectionId,
      })),
    );
    if (collectionsErr) throw new Error(`product_collections: ${collectionsErr.message}`);
  }

  const tagsDel = await supabase.from("product_tags").delete().eq("product_id", productId);
  if (tagsDel.error) throw new Error(`product_tags: ${tagsDel.error.message}`);
  if (payload.tagIds.length > 0) {
    const { error: tagsErr } = await supabase
      .from("product_tags")
      .insert(payload.tagIds.map((tagId) => ({ product_id: productId, tag_id: tagId })));
    if (tagsErr) throw new Error(`product_tags: ${tagsErr.message}`);
  }

  const linksDel = await supabase.from("post_product_tags").delete().eq("product_id", productId);
  if (linksDel.error) throw new Error(`post_product_tags: ${linksDel.error.message}`);
  if (payload.linkedPostIds.length > 0) {
    const { error: linksErr } = await supabase
      .from("post_product_tags")
      .insert(payload.linkedPostIds.map((postId) => ({ product_id: productId, post_id: postId })));
    if (linksErr) throw new Error(`post_product_tags: ${linksErr.message}`);
  }
}

// Defense in depth: the product-form routes already block Save while
// background-upload.ts reports any upload still in flight (see
// hasPendingUploads() in store.products_.new.tsx/$id.tsx), which is what
// should normally stop this from ever being reachable. This is the backstop
// in case some future call path skips that check -- a blob: url written here
// renders fine for the seller in that one tab and is permanently broken
// everywhere else, forever, the moment the object URL is revoked.
function hasBlobImageUrl(payload: ProductSavePayload): boolean {
  const urls: (string | null | undefined)[] = [payload.mainImageUrl];
  if (payload.kind === "regular") {
    urls.push(...(payload.regularAdditionalImageUrls ?? []));
  } else {
    for (const r of payload.rows) {
      urls.push(r.mainImageUrl, ...(r.additionalImageUrls ?? []));
    }
  }
  return urls.some((u) => u?.startsWith("blob:"));
}

async function run(payload: ProductSavePayload) {
  setState({ status: "saving" });
  try {
    if (hasBlobImageUrl(payload)) {
      throw new Error(
        "One or more photos are still uploading — wait for them to finish before saving.",
      );
    }
    if (payload.mode === "create") {
      await runCreate(payload, (productId) => {
        // The products row is committed now. A create is many inserts across
        // several tables and only the first one is the product itself, so a
        // failure at any later step used to leave a real product behind — and
        // Retry, still in create mode, made a SECOND one. Promoting the retry
        // payload to an update against the row we just made is what stops
        // that: runUpdate rebuilds every child table from scratch, which is
        // exactly the cleanup a half-finished create needs.
        pendingPayload = { ...payload, mode: "update", productId };
      });
    } else {
      await runUpdate(payload);
    }
    // Keyed on how this save STARTED, not on the mode it finished in — a
    // promoted retry is still finishing the new-product draft, which the
    // form autosaved under the undefined key.
    clearAutosavedDraft(
      pendingStartedAsCreate || payload.mode === "create" ? undefined : payload.productId,
    );
    setState({ status: "success" });
    setTimeout(() => {
      // Only clear if nothing newer has started since (a fast second save).
      if (state?.status === "success") setState(null);
    }, 2500);
  } catch (err) {
    setState({
      status: "error",
      message: err instanceof Error ? err.message : "Could not save product",
    });
  }
}

/** Kicks off a product create/update in the background. Caller should
 *  navigate away immediately after calling this rather than awaiting it. */
export function startProductSave(payload: ProductSavePayload) {
  pendingPayload = payload;
  pendingStartedAsCreate = payload.mode === "create";
  void run(payload);
}

/** Retries the most recent save.
 *
 *  Not necessarily with the payload it failed with: if the failure happened
 *  after the product row was created, `pendingPayload` has been promoted to an
 *  update against that row, so retrying finishes the product instead of
 *  creating a duplicate. */
export function retryProductSave() {
  if (pendingPayload) void run(pendingPayload);
}

export function dismissProductSave() {
  pendingPayload = null;
  pendingStartedAsCreate = false;
  setState(null);
}
