import type { CategoryNode } from "@/lib/categories";

export type SizeChartLine = { key: string; label: string };

// sizeValue (e.g. "M") -> measurementKey (e.g. "sleeve_length") -> cm
export type SizeMeasurements = Record<string, Record<string, number>>;

// A seller's single size pick for products with no Variant Size option —
// system is one of OptionEditorSheet's SIZE_SYSTEMS keys (XXL/US/UK/Words).
export type ManualSize = { value: string; system: string };

export type SizeChartDefinition = {
  id: string;
  guide:
    | "tshirt"
    | "polo"
    | "dress-shirt"
    | "off-shoulder-top"
    | "nfl-jersey"
    | "football-jersey"
    | "baggy-joggers"
    | "cuffed-joggers"
    | "straight-joggers"
    | "skinny-joggers"
    | "baggy-corporate-trousers"
    | "baggy-jeans"
    | "shorts"
    | "jogger-jorts"
    | "denim-jorts"
    | "dolphin-shorts"
    | "bum-shorts"
    | "denim-bum-shorts"
    | "activewear-tshirt"
    | "standard-tshirt"
    | "polo-alt"
    | "sweatshirt"
    | "basketball-jersey"
    | "cardigan"
    | "cargo-pants"
    | "crop-top"
    | "hoodie"
    | "jumpsuit"
    | "mini-dress"
    | "mini-skirt"
    | "pleated-skirt"
    | "puffer-jacket"
    | "romper"
    | "short-sleeve-shirt"
    | "sports-shorts"
    | "sweater-vest"
    | "tank-top"
    | "turtle-neck"
    | "varsity-jacket";
  lines: SizeChartLine[];
};

// Letter labels match their guide image 1:1, so a seller reads the letter off
// the picture and types the matching number below it — no need to spell out
// the measurement name in the row itself.
const TSHIRT_SHORT_SLEEVE: SizeChartDefinition = {
  id: "tshirt-short-sleeve",
  guide: "tshirt",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
  ],
};

const POLO_SHIRT: SizeChartDefinition = {
  id: "polo-shirt",
  guide: "polo",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
  ],
};

const OFF_SHOULDER_TOP: SizeChartDefinition = {
  id: "off-shoulder-top",
  guide: "off-shoulder-top",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "neck_width", label: "e" },
  ],
};

const NFL_JERSEY: SizeChartDefinition = {
  id: "nfl-jersey",
  guide: "nfl-jersey",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
  ],
};

const FOOTBALL_JERSEY: SizeChartDefinition = {
  id: "football-jersey",
  guide: "football-jersey",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
  ],
};

// Long-sleeve button-up: same five lettered lines as the tee guide, with the
// sleeve line (d) running to the cuff.
const DRESS_SHIRT: SizeChartDefinition = {
  id: "dress-shirt",
  guide: "dress-shirt",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
    { key: "neck_width", label: "e" },
  ],
};

// Every bottoms guide (trousers, joggers, jorts, shorts) is drawn with the
// same three lettered lines, so they share one shape and differ only by
// which illustration a seller sees.
function bottomsChart(id: string, guide: SizeChartDefinition["guide"]): SizeChartDefinition {
  return {
    id,
    guide,
    lines: [
      { key: "waist_width", label: "a" },
      { key: "outseam_length", label: "b" },
      { key: "leg_opening", label: "c" },
    ],
  };
}

const BAGGY_JOGGERS = bottomsChart("baggy-joggers", "baggy-joggers");
const CUFFED_JOGGERS = bottomsChart("cuffed-joggers", "cuffed-joggers");
const STRAIGHT_JOGGERS = bottomsChart("straight-joggers", "straight-joggers");
const SKINNY_JOGGERS = bottomsChart("skinny-joggers", "skinny-joggers");
const BAGGY_CORPORATE_TROUSERS = bottomsChart(
  "baggy-corporate-trousers",
  "baggy-corporate-trousers",
);
const BAGGY_JEANS = bottomsChart("baggy-jeans", "baggy-jeans");
const SHORTS = bottomsChart("shorts", "shorts");
const JOGGER_JORTS = bottomsChart("jogger-jorts", "jogger-jorts");
const DENIM_JORTS = bottomsChart("denim-jorts", "denim-jorts");
const DOLPHIN_SHORTS = bottomsChart("dolphin-shorts", "dolphin-shorts");
const BUM_SHORTS = bottomsChart("bum-shorts", "bum-shorts");
const DENIM_BUM_SHORTS = bottomsChart("denim-bum-shorts", "denim-bum-shorts");

const STANDARD_TOP_LINES: SizeChartLine[] = [
  { key: "shoulder_width", label: "a" },
  { key: "chest_width", label: "b" },
  { key: "body_length", label: "c" },
  { key: "sleeve_length", label: "d" },
  { key: "neck_width", label: "e" },
];

function topChart(id: string, guide: SizeChartDefinition["guide"]): SizeChartDefinition {
  return { id, guide, lines: STANDARD_TOP_LINES };
}

const ACTIVEWEAR_TSHIRT = topChart("activewear-tshirt", "activewear-tshirt");
const STANDARD_TSHIRT = topChart("standard-tshirt", "standard-tshirt");
const POLO_ALT = topChart("polo-alt", "polo-alt");

function letteredChart(
  id: string,
  guide: SizeChartDefinition["guide"],
  keys: string[],
): SizeChartDefinition {
  return {
    id,
    guide,
    lines: keys.map((key, index) => ({ key, label: String.fromCharCode(97 + index) })),
  };
}

const BASKETBALL_JERSEY = letteredChart("basketball-jersey", "basketball-jersey", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const CARDIGAN = letteredChart("cardigan", "cardigan", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
  "armhole_depth",
]);
const CARGO_PANTS = letteredChart("cargo-pants", "cargo-pants", [
  "waist_width",
  "hip_width",
  "inseam_length",
  "outseam_length",
  "leg_opening",
]);
const CROP_TOP = letteredChart("crop-top", "crop-top", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const HOODIE = letteredChart("hoodie", "hoodie", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const JUMPSUIT = letteredChart("jumpsuit", "jumpsuit", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "inseam_length",
  "sleeve_length",
]);
const MINI_DRESS = letteredChart("mini-dress", "mini-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "sleeve_length",
]);
const MINI_SKIRT = letteredChart("mini-skirt", "mini-skirt", [
  "waist_width",
  "hip_width",
  "length",
  "hem_width",
]);
const PLEATED_SKIRT = letteredChart("pleated-skirt", "pleated-skirt", [
  "waist_width",
  "hip_width",
  "length",
  "hem_width",
]);
const PUFFER_JACKET = letteredChart("puffer-jacket", "puffer-jacket", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const ROMPER = letteredChart("romper", "romper", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "inseam_length",
]);
const SHORT_SLEEVE_SHIRT = letteredChart("short-sleeve-shirt", "short-sleeve-shirt", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const SPORTS_SHORTS = letteredChart("sports-shorts", "sports-shorts", [
  "waist_width",
  "hip_width",
  "length",
  "leg_opening",
]);
const SWEATER_VEST = letteredChart("sweater-vest", "sweater-vest", [
  "shoulder_width",
  "body_length",
  "chest_width",
  "hem_width",
  "armhole_depth",
]);
const NEW_SWEATSHIRT = letteredChart("sweatshirt", "sweatshirt", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const TANK_TOP = letteredChart("tank-top", "tank-top", [
  "body_length",
  "chest_width",
  "shoulder_width",
]);
const TURTLE_NECK = letteredChart("turtle-neck", "turtle-neck", [
  "shoulder_width",
  "chest_width",
  "neck_height",
  "sleeve_length",
  "cuff_width",
  "hem_width",
  "body_length",
]);
const VARSITY_JACKET = letteredChart("varsity-jacket", "varsity-jacket", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);

// Every category node id (at any depth in the path) that should get a chart.
// A guide is reused wherever its illustration fairly represents the garment,
// not only for the category it was drawn for — e.g. the generic drawstring
// Shorts guide also covers chino/cargo/jogger shorts, and the T-shirt guide
// covers all five "T-Shirts" leaves in categories.ts.
const CHARTS_BY_CATEGORY: Record<string, SizeChartDefinition> = {
  // Tops
  "clothing-tops-t-shirts": STANDARD_TSHIRT,
  "t-shirts": ACTIVEWEAR_TSHIRT,
  "baby-childrens-tops-t-shirts": TSHIRT_SHORT_SLEEVE,
  "maternity-tops-t-shirts": TSHIRT_SHORT_SLEEVE,
  "nursing-t-shirts": TSHIRT_SHORT_SLEEVE,
  polos: POLO_SHIRT,
  "clothing-tops-polos": POLO_ALT,
  "off-shoulder-tops": OFF_SHOULDER_TOP,
  "nfl-jerseys": NFL_JERSEY,
  "football-jerseys": FOOTBALL_JERSEY,
  "dress-shirts": DRESS_SHIRT,
  "clothing-tops-shirts": DRESS_SHIRT,
  shirts: DRESS_SHIRT,

  // Pants & joggers
  "baggy-joggers": BAGGY_JOGGERS,
  "cuffed-joggers": CUFFED_JOGGERS,
  "pants-joggers": CUFFED_JOGGERS,
  joggers: CUFFED_JOGGERS,
  "loungewear-bottoms-joggers": CUFFED_JOGGERS,
  "straight-joggers": STRAIGHT_JOGGERS,
  "lounge-pants": STRAIGHT_JOGGERS,
  "skinny-joggers": SKINNY_JOGGERS,
  "baggy-corporate-trousers": BAGGY_CORPORATE_TROUSERS,
  "pants-trousers": BAGGY_CORPORATE_TROUSERS,
  "pants-chinos": BAGGY_CORPORATE_TROUSERS,
  "palazzo-pants": BAGGY_CORPORATE_TROUSERS,
  "harem-pants": BAGGY_CORPORATE_TROUSERS,
  "baggy-jeans": BAGGY_JEANS,
  "pants-jeans": BAGGY_JEANS,
  "pants-jeggings": BAGGY_JEANS,

  // Shorts & jorts
  shorts: SHORTS,
  "jogger-shorts": SHORTS,
  "chino-shorts": SHORTS,
  "cargo-shorts": SHORTS,
  bermudas: SHORTS,
  "short-trousers": SHORTS,
  "legging-shorts": SHORTS,
  "loungewear-bottoms-shorts": SHORTS,
  "jogger-jorts": JOGGER_JORTS,
  "denim-jorts": DENIM_JORTS,
  "denim-shorts": DENIM_JORTS,
  "dolphin-shorts": DOLPHIN_SHORTS,
  "bum-shorts": BUM_SHORTS,
  "jegging-shorts": BUM_SHORTS,
  "denim-bum-shorts": DENIM_BUM_SHORTS,
  "clothing-tops-sweatshirts": NEW_SWEATSHIRT,
  "volleyball-shorts": SHORTS,
  "basketball-jerseys": BASKETBALL_JERSEY,
  "clothing-tops-cardigans": CARDIGAN,
  "cargo-pants": CARGO_PANTS,
  "crop-tops": CROP_TOP,
  "clothing-tops-hoodies": HOODIE,
  jumpsuits: JUMPSUIT,
  "costume-onesies-jumpsuits": JUMPSUIT,
  "mini-dresses": MINI_DRESS,
  "mini-skirts": MINI_SKIRT,
  "pleated-skirts": PLEATED_SKIRT,
  "coats-jackets-puffer-jackets": PUFFER_JACKET,
  rompers: ROMPER,
  "short-sleeve-shirts": SHORT_SLEEVE_SHIRT,
  "sports-shorts": SPORTS_SHORTS,
  "outerwear-vests": SWEATER_VEST,
  "clothing-tops-tank-tops": TANK_TOP,
  "turtle-necks": TURTLE_NECK,
  "varsity-jackets": VARSITY_JACKET,
};

// Only categories explicitly mapped above get a guide. Adding a new guide is
// intentionally data-only: add the definition, map its category ids here,
// and add its image to SizeChartSheet's GUIDE_IMAGES map.
/** Every chart the app can actually show, deduplicated — several categories
 *  share one definition. Exported so a test can assert that each shape either
 *  has a weight formula or is a documented exception; an artwork batch that
 *  adds a guide without one otherwise passes every gate and silently reports
 *  "we can't estimate this shape" to sellers. */
export const ALL_SIZE_CHARTS: SizeChartDefinition[] = [
  ...new Map(Object.values(CHARTS_BY_CATEGORY).map((c) => [c.guide, c])).values(),
];

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
type MeasurementKey =
  | "shoulder_width"
  | "chest_width"
  | "body_length"
  | "sleeve_length"
  | "neck_width";

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
export function isMeasurementSetPlausible(
  values: Partial<Record<MeasurementKey, number>>,
): boolean {
  for (const { a, b, min, max } of RATIO_BOUNDS) {
    const va = values[a];
    const vb = values[b];
    if (va == null || vb == null || va <= 0 || vb <= 0) continue;
    const ratio = va / vb;
    if (ratio < min || ratio > max) return false;
  }
  return true;
}
