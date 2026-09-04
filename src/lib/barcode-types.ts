// Shared between InventorySheet, BarcodesSheet, BarcodeScanSheet, and both
// product-form routes -- a SKU can carry more than one barcode (its own
// custom code alongside a manufacturer's GTIN/UPC/EAN, say), each tagged
// with what kind of code it is. Backed by product_variant_barcodes (one row
// per entry), not the old single product_variants.barcode column.
export type BarcodeType = "custom" | "gtin" | "upc" | "ean" | "isbn" | "asin";

export type BarcodeEntry = {
  type: BarcodeType;
  value: string;
};

export const BARCODE_TYPES: BarcodeType[] = ["custom", "gtin", "upc", "ean", "isbn", "asin"];

export const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  custom: "Custom",
  gtin: "GTIN",
  upc: "UPC",
  ean: "EAN",
  isbn: "ISBN",
  asin: "ASIN",
};

/** Coerces whatever the DB hands back (a plain text column, not a real enum)
 *  into a known type -- falls back to "custom" for anything unrecognized
 *  rather than letting a stray value break the type dropdown. */
export function toBarcodeType(raw: string): BarcodeType {
  return (BARCODE_TYPES as string[]).includes(raw) ? (raw as BarcodeType) : "custom";
}
