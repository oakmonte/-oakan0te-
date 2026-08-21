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

// Letter labels (a-e) match the lettered measurement guide image shown in the
// sheet (public/size-chart/tshirt-guide.png) 1:1, so a seller reads the
// letter off the picture and types the matching number below it — no need to
// spell out "shoulder width" etc. in the row itself.
const TSHIRT_SHORT_SLEEVE: SizeChartDefinition = {
  id: "tshirt-short-sleeve",
  outline: "tshirt-short-sleeve",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
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
// POSTPONED.md §2.1) — deliberately narrow to one category. Add more entries
// here (and more SizeChartDefinitions) once this shape has been reviewed;
// nothing else needs to change to support it.
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

// --- Silent plausibility check -------------------------------------------
//
// Ratio bounds below are centered on a real tech-pack XS-3XL adult tee chart
// (shoulder/chest/body-length/sleeve, inches, seller-supplied reference) and
// then widened substantially to cover the marketplace's actual range of tee
// cuts (boxy oversized streetwear, cropped, slim, kids' sizing) rather than
// pinning to one brand's fit. This is a typo/garbled-input net, not a fit
// standard — it must stay loose enough that no legitimate tee gets rejected.
// Source ratios observed across XS-3XL before widening:
//   sleeve/body   0.296-0.301   shoulder/chest  0.919-0.943
//   chest/body    0.746-0.917   sleeve/chest    0.328-0.395
//   shoulder/body 0.687-0.865
// `neck_width` had no source data — bounded only against shoulder_width and
// body_length with deliberately loose sanity ranges.
//
// Deliberately not surfaced to sellers (no ratio numbers, no rule text) —
// see plausibility check call sites for the generic, non-specific copy shown
// instead.
type MeasurementKey = "shoulder_width" | "chest_width" | "body_length" | "sleeve_length" | "neck_width";

const RATIO_BOUNDS: { a: MeasurementKey; b: MeasurementKey; min: number; max: number }[] = [
  { a: "sleeve_length", b: "body_length", min: 0.15, max: 0.55 },
  { a: "shoulder_width", b: "chest_width", min: 0.55, max: 1.3 },
  { a: "chest_width", b: "body_length", min: 0.45, max: 1.3 },
  { a: "sleeve_length", b: "chest_width", min: 0.15, max: 0.6 },
  { a: "shoulder_width", b: "body_length", min: 0.4, max: 1.15 },
  { a: "neck_width", b: "shoulder_width", min: 0.15, max: 0.85 },
  { a: "neck_width", b: "body_length", min: 0.1, max: 0.55 },
];

// Checks every measurement pair that has both values filled in (cm, any
// single size's set) against its ratio bounds. Returns true only if every
// applicable pair is plausible — false the moment one falls outside range.
export function isMeasurementSetPlausible(values: Partial<Record<MeasurementKey, number>>): boolean {
  for (const { a, b, min, max } of RATIO_BOUNDS) {
    const va = values[a];
    const vb = values[b];
    if (va == null || vb == null || va <= 0 || vb <= 0) continue;
    const ratio = va / vb;
    if (ratio < min || ratio > max) return false;
  }
  return true;
}
