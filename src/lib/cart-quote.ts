import { supabase } from "@/lib/integrations/my-supabase/client";
import { stockCeiling, variantLabelOf } from "@/lib/order-lines";
import { addToCart, getCartItems, type FreshProduct } from "@/lib/cart";

/** What the database says about these products right now: active ones only,
 *  with every variant's price, stock and label. A product missing from the
 *  result is unavailable (deleted or unpublished). Throws when the lookup
 *  itself fails, so a caller can tell "gone" from "couldn't check". */
export async function loadFreshProducts(productIds: string[]): Promise<Map<string, FreshProduct>> {
  const ids = [...new Set(productIds)];
  const out = new Map<string, FreshProduct>();
  if (ids.length === 0) return out;

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, store_id, product_variants(id, price, stock_qty, continue_selling_out_of_stock, option1_name, option2_name, option3_name, option1_value, option2_value, option3_value, main_image_url)",
    )
    .in("id", ids)
    .eq("status", "active")
    // The same order the product page lists sizes in.
    .order("created_at", { referencedTable: "product_variants", ascending: true });
  if (error) throw error;

  const storeIds = [...new Set((data ?? []).map((p) => p.store_id))];
  const { data: stores, error: storeErr } = storeIds.length
    ? await supabase.from("stores").select("id, brand_name").in("id", storeIds)
    : { data: [], error: null };
  if (storeErr) throw storeErr;
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.brand_name]));

  for (const p of data ?? []) {
    const variants = p.product_variants ?? [];
    // The product's first photo stands in for a variant that has none.
    const fallbackImage = variants.find((v) => v.main_image_url)?.main_image_url ?? null;
    // "Size", or "Size / Colour" when the labels carry two values.
    const named = variants.find((v) => v.option1_name || v.option2_name || v.option3_name);
    const optionName = named
      ? [named.option1_name, named.option2_name, named.option3_name]
          .map((n) => n?.trim())
          .filter(Boolean)
          .join(" / ")
      : "";
    out.set(p.id, {
      id: p.id,
      title: p.title ?? "Untitled",
      storeId: p.store_id,
      storeName: storeName.get(p.store_id) ?? "Store",
      optionName: optionName || null,
      variants: variants.map((v) => ({
        id: v.id,
        label: variantLabelOf(v, variants.length),
        // A zero price is the seller not having set one; the server refuses
        // it ("has no price"), so the bag must not offer it as buyable.
        unitPrice: v.price != null && v.price > 0 ? v.price : null,
        imageUrl: v.main_image_url ?? fallbackImage,
        stock: stockCeiling(v),
      })),
    });
  }
  return out;
}

export type BulkAddResult = {
  /** Units that went into the bag. */
  added: number;
  /** Of those, how many still need a size picked in the bag. */
  needChoice: number;
  /** Products that couldn't go in: sold out, unpriced or no longer listed. */
  unavailable: number;
  /** Products already in the bag as many times as there are left. */
  atLimit: number;
};

/** Puts one of each product in the bag, for the feed's +Cart: a post's tagged
 *  pieces in one tap. A product with one variant goes in as it is. One with
 *  several goes in on its first available option, flagged so the bag asks
 *  for a real choice before checkout rather than shipping a guessed size. */
export async function addProductsToCart(productIds: string[]): Promise<BulkAddResult> {
  const fresh = await loadFreshProducts(productIds);
  const result: BulkAddResult = { added: 0, needChoice: 0, unavailable: 0, atLimit: 0 };
  for (const id of new Set(productIds)) {
    const product = fresh.get(id);
    const available = product?.variants.filter((v) => v.unitPrice != null && v.stock !== 0) ?? [];
    // Already in the bag in some size: one more of THAT, not a second line
    // on a guessed size.
    const inBag = getCartItems().find(
      (i) => i.productId === id && available.some((v) => v.id === i.variantId),
    );
    const pick = available.find((v) => v.id === inBag?.variantId) ?? available[0];
    if (!product || !pick) {
      result.unavailable += 1;
      continue;
    }
    const needsChoice = product.variants.length > 1;
    const added = addToCart({
      productId: product.id,
      variantId: pick.id,
      title: product.title,
      variantLabel: pick.label,
      imageUrl: pick.imageUrl,
      unitPrice: pick.unitPrice,
      storeId: product.storeId,
      storeName: product.storeName,
      maxQuantity: pick.stock,
      needsChoice,
    });
    if (added === 0) {
      result.atLimit += 1;
      continue;
    }
    result.added += added;
    // Read back rather than assumed: a line whose size was already picked
    // keeps it when the same piece is added again.
    if (getCartItems().find((i) => i.variantId === pick.id)?.needsChoice) result.needChoice += 1;
  }
  return result;
}
