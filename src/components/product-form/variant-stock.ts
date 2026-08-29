/** Total stock for a SKU: the sum of its per-location quantities, falling back
 *  to any legacy (location-less) stock while none have been assigned. */
export function stockTotal(input: {
  locationQuantities: Record<string, number>;
  legacyStockQty?: number;
}): number {
  const keys = Object.keys(input.locationQuantities);
  if (keys.length === 0) return input.legacyStockQty ?? 0;
  return Object.values(input.locationQuantities).reduce((sum, n) => sum + n, 0);
}
