/** The key the product form uses, in `locationQuantities`, for stock held
 *  with no pickup location ("No location added"). It is stored as a
 *  product_variant_stock row whose location_id is null (migration
 *  20261109120000_stock_without_location.sql); these two helpers are the only
 *  place the key and the null meet. */
export const NO_LOCATION = "no-location";

/** Form key -> database location_id. */
export function toLocationId(key: string): string | null {
  return key === NO_LOCATION ? null : key;
}

/** Database location_id -> form key. */
export function fromLocationId(locationId: string | null): string {
  return locationId ?? NO_LOCATION;
}
