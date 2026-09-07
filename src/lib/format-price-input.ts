// Shared by every price input in the product form (PricingSheet's PriceBox,
// VariantCombinationsSheet's MiniField) so "type in a price, see commas"
// behaves identically everywhere instead of drifting between copies.

/** Keeps at most one decimal point and 2 digits after it, stripping
 *  everything else — this is the raw value handed to onChange (no commas),
 *  so existing Number()/parseFloat() consumers don't need to change. */
export function cleanPriceDigits(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) {
    cleaned = cleaned.slice(0, dotIndex + 3);
  }
  return cleaned;
}

/** Adds thousands separators to the integer part while typing, without
 *  touching a decimal portion that's still being typed (so "20000.5" reads
 *  as "20,000.5", not forced to "20,000.50" until the field is done with). */
export function displayPriceWithCommas(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const commaInt = (intPart ? Number(intPart) : 0).toLocaleString("en-US");
  if (raw.includes(".")) return `${commaInt}.${decPart ?? ""}`;
  return commaInt;
}

/** Pads to exactly 2 decimal places once the seller leaves the field. */
export function padPriceOnBlur(raw: string): string {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split(".");
  return `${intPart || "0"}.${(decPart ?? "").padEnd(2, "0").slice(0, 2)}`;
}
