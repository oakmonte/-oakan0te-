// Shopify-style unit pricing ("₦X per 100ml") — optional, off by default,
// stored per product_variants row (the same table price/compareAt/cost
// already live on, since a "regular" product is just one implicit variant).

export type UnitCategory = "volume" | "weight" | "length" | "area" | "count";

export const UNIT_ORDER = [
  "fl oz",
  "pt",
  "qt",
  "gal",
  "oz",
  "lb",
  "in",
  "ft",
  "yd",
  "ft²",
  "item",
] as const;

export type Unit = (typeof UNIT_ORDER)[number];

// factor = how many of the category's smallest listed unit one of this unit
// equals — e.g. 1 lb = 16 oz, so lb's factor is 16.
const UNIT_INFO: Record<Unit, { category: UnitCategory; factor: number }> = {
  "fl oz": { category: "volume", factor: 1 },
  pt: { category: "volume", factor: 16 },
  qt: { category: "volume", factor: 32 },
  gal: { category: "volume", factor: 128 },
  oz: { category: "weight", factor: 1 },
  lb: { category: "weight", factor: 16 },
  in: { category: "length", factor: 1 },
  ft: { category: "length", factor: 12 },
  yd: { category: "length", factor: 36 },
  "ft²": { category: "area", factor: 1 },
  item: { category: "count", factor: 1 },
};

export function unitCategory(unit: string): UnitCategory | null {
  return (UNIT_INFO as Record<string, { category: UnitCategory }>)[unit]?.category ?? null;
}

export function unitsForCategory(category: UnitCategory): Unit[] {
  return UNIT_ORDER.filter((u) => UNIT_INFO[u].category === category);
}

// Price for exactly 1 `baseUnit`, given the listing's total measurement in
// `totalUnit`. Returns null if the units aren't in the same family (can't be
// compared) or there's nothing to divide by yet.
export function computeUnitPrice(
  price: number,
  totalMeasurement: number,
  totalUnit: string,
  baseUnit: string,
): number | null {
  const t = (UNIT_INFO as Record<string, { category: UnitCategory; factor: number }>)[totalUnit];
  const b = (UNIT_INFO as Record<string, { category: UnitCategory; factor: number }>)[baseUnit];
  if (!t || !b || t.category !== b.category) return null;
  if (!(totalMeasurement > 0) || !(price >= 0)) return null;
  const totalInSmallestUnits = totalMeasurement * t.factor;
  return (price / totalInSmallestUnits) * b.factor;
}
