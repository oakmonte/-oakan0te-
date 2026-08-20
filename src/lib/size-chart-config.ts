import type { CategoryNode } from "@/lib/categories";

export type SizeChartLine = { key: string; label: string };

// sizeValue (e.g. "M") -> measurementKey (e.g. "sleeve_length") -> cm
export type SizeMeasurements = Record<string, Record<string, number>>;

// A seller's single size pick for products with no Variant Size option —
// system is one of OptionEditorSheet's SIZE_SYSTEMS keys (XXL/US/UK/Words).
export type ManualSize = { value: string; system: string };

export type SizeChartDefinition = {
  id: string;
  outline: "tshirt-short-sleeve";
  lines: SizeChartLine[];
};

const TSHIRT_SHORT_SLEEVE: SizeChartDefinition = {
  id: "tshirt-short-sleeve",
  outline: "tshirt-short-sleeve",
  lines: [
    { key: "sleeve_length", label: "Sleeve length" },
    { key: "body_length", label: "Body length" },
  ],
};

// Every category node id (at any depth in the path) that should get the
// T-shirt chart. All five "T-Shirts" leaves in categories.ts share one
// definition — see src/lib/categories.ts:49,168,257,409,415.
const CHARTS_BY_CATEGORY: Record<string, SizeChartDefinition> = {
  "clothing-tops-t-shirts": TSHIRT_SHORT_SLEEVE,
  "t-shirts": TSHIRT_SHORT_SLEEVE,
  "baby-childrens-tops-t-shirts": TSHIRT_SHORT_SLEEVE,
  "maternity-tops-t-shirts": TSHIRT_SHORT_SLEEVE,
  "nursing-t-shirts": TSHIRT_SHORT_SLEEVE,
};

// First test case for the universal size chart (see root CLAUDE.md /
// POSTPONED.md §2.1) — deliberately narrow to one category and two
// measurements. Add more entries here (and more SizeChartDefinitions) once
// this shape has been reviewed; nothing else needs to change to support it.
export function getSizeChartForCategory(categoryPath: CategoryNode[]): SizeChartDefinition | null {
  for (const node of categoryPath) {
    const chart = CHARTS_BY_CATEGORY[node.id];
    if (chart) return chart;
  }
  return null;
}

export const CM_PER_INCH = 2.54;

export function cmToDisplay(cm: number, unit: "cm" | "in"): number {
  return unit === "cm" ? cm : cm / CM_PER_INCH;
}

export function displayToCm(value: number, unit: "cm" | "in"): number {
  return unit === "cm" ? value : value * CM_PER_INCH;
}
