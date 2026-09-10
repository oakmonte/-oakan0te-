/** What `products.is_complete` means.
 *
 *  Two independent axes live on `products` and answer different questions
 *  (see the canonical-product-schema skill):
 *
 *    status       seller intent      — draft vs active, governs buyer visibility
 *    is_complete  record readiness   — whether it CAN be listed at all
 *
 *  A seller looking at their products list needs to tell "I haven't published
 *  this yet" apart from "this can't be published yet", so neither may be
 *  inferred from the other.
 *
 *  The bar below is deliberately "what a buyer needs to see and what a courier
 *  needs to quote", not "every column is populated". Two rules this replaces
 *  were both wrong in opposite directions:
 *
 *    - The manual form hardcoded `is_complete: true` on every save, so the
 *      flag carried no information at all.
 *    - The importer required title, both descriptions, brand, product_type,
 *      category_id, and per variant sku + barcode + material + material_feel +
 *      cost_price. It also hardcoded categoryId to null, so the category check
 *      could never pass and NOTHING could ever be complete — the rest of that
 *      rule was unreachable.
 *
 *  Barcode, cost price and material_feel are all real fields a seller may
 *  reasonably never fill; gating listability on them makes the flag a nag
 *  rather than a signal.
 *
 *  **This file is mirrored in `oakmonte-import-worker/lib/completeness.js`.**
 *  That copy is the only mechanism carrying the rule across the repo boundary
 *  — change one and change the other, or imported and manually-created
 *  products stop meaning the same thing by the same name.
 */

export type CompletenessVariant = {
  price: number | null;
  mainImageUrl: string | null;
  weightGrams: number | null;
};

export type CompletenessInput = {
  title: string | null;
  variants: CompletenessVariant[];
};

/** Human-readable list of what's still missing, in the order a seller would
 *  most naturally fix it. Empty means complete. Returned rather than just a
 *  boolean so the products list can eventually say *why* something can't be
 *  listed instead of only that it can't. */
export function missingForCompleteness(input: CompletenessInput): string[] {
  const missing: string[] = [];

  if (!input.title?.trim()) missing.push("a title");
  if (input.variants.length === 0) {
    missing.push("at least one variant");
    return missing;
  }

  // Counted rather than reported per-variant: "3 variants have no price" is
  // actionable, a list of every offending variant key is not.
  const unpriced = input.variants.filter((v) => v.price == null || v.price <= 0).length;
  const unpictured = input.variants.filter((v) => !v.mainImageUrl?.trim()).length;
  const unweighed = input.variants.filter(
    (v) => v.weightGrams == null || v.weightGrams <= 0,
  ).length;

  const label = (n: number) => (input.variants.length === 1 ? "" : ` (${n})`);
  if (unpriced > 0) missing.push(`a price${label(unpriced)}`);
  if (unpictured > 0) missing.push(`a photo${label(unpictured)}`);
  if (unweighed > 0) missing.push(`a weight${label(unweighed)}`);

  return missing;
}

export function computeIsComplete(input: CompletenessInput): boolean {
  return missingForCompleteness(input).length === 0;
}
