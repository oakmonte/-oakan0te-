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
    | "varsity-jacket"
    | "a-line-dress"
    | "bermuda-shorts"
    | "biker-shorts"
    | "compression-shirt"
    | "flared-pants"
    | "gilet"
    | "harem-pants"
    | "henley"
    | "leather-jacket"
    | "leather-pants"
    | "leggings"
    | "linen-pants"
    | "off-shoulder-dress"
    | "palazzo"
    | "parachute-pants"
    | "parka"
    | "senator-wear"
    | "shirt-dress"
    | "slip-dress"
    | "sports-bra"
    | "track-jacket"
    | "trucker-jacket"
    | "tunic"
    | "corset"
    | "peplum-top"
    | "wrap-dress";
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
    { key: "body_length", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "shoulder_width", label: "c" },
    { key: "sleeve_length", label: "d" },
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

const STANDARD_TSHIRT = topChart("standard-tshirt", "standard-tshirt");

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

const FOUR_LINE_BOTTOM = (id: string, guide: SizeChartDefinition["guide"]) =>
  letteredChart(id, guide, ["waist_width", "hip_width", "inseam_length", "leg_opening"]);
const FOUR_LINE_SHORTS = (id: string, guide: SizeChartDefinition["guide"]) =>
  letteredChart(id, guide, ["waist_width", "hip_width", "outseam_length", "leg_opening"]);
const A_LINE_DRESS = letteredChart("a-line-dress", "a-line-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hem_width",
]);
const BERMUDA_SHORTS = FOUR_LINE_SHORTS("bermuda-shorts", "bermuda-shorts");
const BIKER_SHORTS = FOUR_LINE_SHORTS("biker-shorts", "biker-shorts");
const COMPRESSION_SHIRT = letteredChart("compression-shirt", "compression-shirt", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const FLARED_PANTS = FOUR_LINE_BOTTOM("flared-pants", "flared-pants");
const GILET = letteredChart("gilet", "gilet", ["body_length", "chest_width", "shoulder_width"]);
const HAREM_PANTS = FOUR_LINE_BOTTOM("harem-pants", "harem-pants");
const HENLEY = letteredChart("henley", "henley", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const LEATHER_JACKET = letteredChart("leather-jacket", "leather-jacket", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const LEATHER_PANTS = FOUR_LINE_BOTTOM("leather-pants", "leather-pants");
const LEGGINGS = FOUR_LINE_BOTTOM("leggings", "leggings");
const LINEN_PANTS = FOUR_LINE_BOTTOM("linen-pants", "linen-pants");
const OFF_SHOULDER_DRESS = letteredChart("off-shoulder-dress", "off-shoulder-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "sleeve_length",
]);
const PALAZZO = FOUR_LINE_BOTTOM("palazzo", "palazzo");
const PARACHUTE_PANTS = FOUR_LINE_BOTTOM("parachute-pants", "parachute-pants");
const PARKA = letteredChart("parka", "parka", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const SENATOR_WEAR = letteredChart("senator-wear", "senator-wear", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const SHIRT_DRESS = letteredChart("shirt-dress", "shirt-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "sleeve_length",
]);
const SLIP_DRESS = letteredChart("slip-dress", "slip-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
]);
const SPORTS_BRA = letteredChart("sports-bra", "sports-bra", [
  "body_length",
  "chest_width",
  "hem_width",
]);
const TRACK_JACKET = letteredChart("track-jacket", "track-jacket", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const TRUCKER_JACKET = letteredChart("trucker-jacket", "trucker-jacket", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const TUNIC = letteredChart("tunic", "tunic", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
]);
const CORSET = letteredChart("corset", "corset", ["body_length", "chest_width", "waist_width"]);
const PEPLUM_TOP = letteredChart("peplum-top", "peplum-top", [
  "body_length",
  "chest_width",
  "shoulder_width",
  "sleeve_length",
  "hem_width",
]);
const WRAP_DRESS = letteredChart("wrap-dress", "wrap-dress", [
  "body_length",
  "chest_width",
  "waist_width",
  "hip_width",
  "sleeve_length",
]);

// Every category node id (at any depth in the path) that should get a chart.
// A guide is reused wherever its illustration fairly represents the garment,
// not only for the category it was drawn for — e.g. Trousers borrows the
// baggy corporate trousers guide, and Costume Tops borrows the T-shirt guide.
// categories.test.ts asserts every key here exists in categories.ts.
const CHARTS_BY_CATEGORY: Record<string, SizeChartDefinition> = {
  // Tops
  "t-shirts": STANDARD_TSHIRT,
  "short-sleeve-shirts": SHORT_SLEEVE_SHIRT,
  shirts: DRESS_SHIRT,
  "dress-shirts": DRESS_SHIRT,
  "short-sleeve-dress-shirts": SHORT_SLEEVE_SHIRT,
  polos: POLO_SHIRT,
  "henley-shirts": HENLEY,
  "tank-tops": TANK_TOP,
  "crop-tops": CROP_TOP,
  "corset-tops": CORSET,
  "off-shoulder-tops": OFF_SHOULDER_TOP,
  "peplum-tops": PEPLUM_TOP,
  tunics: TUNIC,
  hoodies: HOODIE,
  sweatshirts: NEW_SWEATSHIRT,
  cardigans: CARDIGAN,
  turtlenecks: TURTLE_NECK,
  "sweater-vests": SWEATER_VEST,

  // Pants & trousers
  trousers: BAGGY_CORPORATE_TROUSERS,
  "baggy-corporate-trousers": BAGGY_CORPORATE_TROUSERS,
  jeans: BAGGY_JEANS,
  "baggy-jeans": BAGGY_JEANS,
  "cargo-pants": CARGO_PANTS,
  "baggy-joggers": BAGGY_JOGGERS,
  "cuffed-joggers": CUFFED_JOGGERS,
  "straight-joggers": STRAIGHT_JOGGERS,
  "skinny-joggers": SKINNY_JOGGERS,
  leggings: LEGGINGS,
  "palazzo-pants": PALAZZO,
  "flared-pants": FLARED_PANTS,
  "harem-pants": HAREM_PANTS,
  "parachute-pants": PARACHUTE_PANTS,
  "leather-pants": LEATHER_PANTS,
  "linen-pants": LINEN_PANTS,

  // Shorts & jorts
  shorts: SHORTS,
  "bermuda-shorts": BERMUDA_SHORTS,
  "biker-shorts": BIKER_SHORTS,
  "sports-shorts": SPORTS_SHORTS,
  "dolphin-shorts": DOLPHIN_SHORTS,
  "bum-shorts": BUM_SHORTS,
  "denim-bum-shorts": DENIM_BUM_SHORTS,
  "denim-jorts": DENIM_JORTS,
  "jogger-jorts": JOGGER_JORTS,

  // Skirts & dresses
  "mini-skirts": MINI_SKIRT,
  "pleated-skirts": PLEATED_SKIRT,
  "mini-dresses": MINI_DRESS,
  "a-line-dresses": A_LINE_DRESS,
  "slip-dresses": SLIP_DRESS,
  "wrap-dresses": WRAP_DRESS,
  "shirt-dresses": SHIRT_DRESS,
  "off-shoulder-dresses": OFF_SHOULDER_DRESS,
  jumpsuits: JUMPSUIT,
  rompers: ROMPER,

  // Outerwear
  "puffer-jackets": PUFFER_JACKET,
  parkas: PARKA,
  "leather-jackets": LEATHER_JACKET,
  "trucker-jackets": TRUCKER_JACKET,
  "track-jackets": TRACK_JACKET,
  "varsity-jackets": VARSITY_JACKET,
  gilets: GILET,

  // Traditional, activewear, underwear, kids
  "senator-wear": SENATOR_WEAR,
  "sports-bras": SPORTS_BRA,
  "compression-shirts": COMPRESSION_SHIRT,
  "football-jerseys": FOOTBALL_JERSEY,
  "basketball-jerseys": BASKETBALL_JERSEY,
  "nfl-jerseys": NFL_JERSEY,
  "corsets-bustiers": CORSET,
  undershirts: TANK_TOP,

  // Kids' pieces are the adult shape, smaller — the guide is only there to
  // show the seller where to measure.
  "kids-t-shirts": TSHIRT_SHORT_SLEEVE,
  "kids-tops": STANDARD_TSHIRT,
  "kids-trousers": BAGGY_CORPORATE_TROUSERS,
  "kids-shorts": SHORTS,
  "kids-dresses": A_LINE_DRESS,
  "baby-clothing": ROMPER,

  // No art of their own, but close enough in silhouette to measure the same
  // spans off a borrowed picture. Deliberately unmapped: drapes and bundles
  // (agbada, boubous, abayas, saris, iro & buba, sets, pajamas, robes) and
  // blazers, bodysuits and cheongsams, which no existing guide resembles.
  blouses: DRESS_SHIRT,
  sweaters: NEW_SWEATSHIRT,
  kaftans: TUNIC,
  dashikis: TUNIC,
  kurtas: TUNIC,
  kimonos: CARDIGAN,
  jackets: TRUCKER_JACKET,
  "bomber-jackets": VARSITY_JACKET,
  coats: PARKA,
  "midi-maxi-skirts": PLEATED_SKIRT,
  "maxi-dresses": A_LINE_DRESS,
  "wedding-dresses": A_LINE_DRESS,
  nightgowns: SLIP_DRESS,
  "swim-trunks": SHORTS,

  // Costumes. A costume top, dress or jumpsuit is measured exactly like its
  // everyday counterpart. Deliberately not mapped: costume-sets (a
  // top-plus-bottom bundle has no single chart), costume-capes (a drape has
  // no chest/shoulder span to measure), and costume-accessories (not a sized
  // garment at all).
  "costume-tops": STANDARD_TSHIRT,
  "costume-dresses": A_LINE_DRESS,
  "costume-jumpsuits": JUMPSUIT,
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

// Footwear has no illustrated chart and never will have one of this kind —
// shoes aren't measured by lettered spans across a flat-laid garment. What it
// does need is the right ladder in the manual Size picker: shoe numbers, not
// S/M/L. `footwear` covers its whole subtree (the path carries every
// ancestor) except Shoe Care & Accessories — laces and insoles aren't sized in
// shoe numbers.
export const FOOTWEAR_CATEGORY_ID = "footwear";
export const SHOE_CARE_CATEGORY_ID = "shoe-care";

export function isFootwearCategory(categoryPath: CategoryNode[]): boolean {
  return (
    categoryPath.some((node) => node.id === FOOTWEAR_CATEGORY_ID) &&
    !categoryPath.some((node) => node.id === SHOE_CARE_CATEGORY_ID)
  );
}

/** Exported only for categories.test.ts, which checks each key is a real category id. */
export const SIZE_CHART_CATEGORY_IDS = Object.keys(CHARTS_BY_CATEGORY);

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

// --- Preset measurements for categories with no guide picture -------------
//
// What the manual Size sheet pre-fills when no chart (and so no artwork)
// covers a category: the spans a seller should measure, laid flat, in cm.
// Looked up leaf-first, so a specific leaf beats its group, and the group
// entries catch "All Tops"-style picks and custom categories underneath.
// Labels double as the stored measurement_key, same as hand-typed ones.
const TOP = ["Chest", "Shoulder", "Length", "Sleeve"];
const BOTTOM = ["Waist", "Hip", "Inseam", "Leg opening"];
const SHORTS_SET = ["Waist", "Hip", "Length", "Leg opening"];
const SKIRT = ["Waist", "Hip", "Length"];
const DRESS = ["Bust", "Waist", "Hip", "Length"];
const TOP_AND_BOTTOM = [
  "Top chest",
  "Top length",
  "Sleeve",
  "Bottom waist",
  "Bottom hip",
  "Bottom length",
];
const SHOE = ["Insole length", "Insole width"];

const PRESET_MEASUREMENTS_BY_CATEGORY: Record<string, string[]> = {
  // Groups and catch-alls
  fashion: ["Chest", "Waist", "Hip", "Length"],
  clothing: ["Chest", "Waist", "Hip", "Length"],
  tops: TOP,
  "pants-trousers": BOTTOM,
  "shorts-jorts": SHORTS_SET,
  skirts: SKIRT,
  dresses: DRESS,
  "jumpsuits-rompers": ["Chest", "Waist", "Hip", "Length", "Inseam"],
  outerwear: TOP,
  "suits-sets": TOP_AND_BOTTOM,
  "traditional-wear": ["Chest", "Shoulder", "Length", "Sleeve"],
  activewear: TOP,
  "underwear-lingerie": ["Waist", "Hip"],
  "sleepwear-loungewear": TOP_AND_BOTTOM,
  swimwear: ["Bust", "Waist", "Hip"],
  "kids-clothing": ["Chest", "Waist", "Length"],
  costumes: ["Chest", "Waist", "Length"],
  "uniforms-workwear": TOP_AND_BOTTOM,
  footwear: SHOE,

  // Leaves
  bodysuits: ["Chest", "Waist", "Shoulder", "Length"],
  "bodycon-dresses": DRESS,
  blazers: ["Chest", "Shoulder", "Length", "Sleeve", "Waist"],
  suits: [
    "Jacket chest",
    "Jacket shoulder",
    "Jacket length",
    "Sleeve",
    "Trouser waist",
    "Trouser inseam",
  ],
  "two-piece-sets": TOP_AND_BOTTOM,
  tracksuits: TOP_AND_BOTTOM,
  agbada: ["Agbada length", "Agbada width", "Neck", "Trouser waist", "Trouser length"],
  "iro-buba": ["Buba bust", "Buba length", "Sleeve", "Wrapper length", "Wrapper width"],
  boubous: ["Length", "Width", "Neck opening"],
  "abayas-jilbabs": ["Bust", "Shoulder", "Length", "Sleeve"],
  saris: ["Sari length", "Sari width", "Blouse bust", "Blouse length"],
  cheongsams: ["Bust", "Waist", "Hip", "Shoulder", "Length"],
  bras: ["Underband", "Bust"],
  panties: ["Waist", "Hip"],
  "boxers-briefs": ["Waist", "Hip", "Length"],
  "lingerie-sets": ["Underband", "Bust", "Waist", "Hip"],
  shapewear: ["Waist", "Hip", "Length"],
  "tights-hosiery": ["Waist", "Hip", "Length"],
  pajamas: TOP_AND_BOTTOM,
  robes: ["Chest", "Length", "Sleeve"],
  "loungewear-sets": TOP_AND_BOTTOM,
  bikinis: ["Underband", "Bust", "Waist", "Hip"],
  "one-piece-swimsuits": ["Bust", "Waist", "Hip", "Torso length"],
  burkinis: ["Bust", "Waist", "Hip", "Length", "Sleeve"],
  "cover-ups": ["Bust", "Length"],
  "kids-sets": TOP_AND_BOTTOM,
  "costume-sets": TOP_AND_BOTTOM,
  "costume-capes": ["Length", "Neck", "Hem width"],
  "school-uniforms": TOP_AND_BOTTOM,
  scrubs: TOP_AND_BOTTOM,
  workwear: TOP_AND_BOTTOM,
  socks: ["Foot length", "Leg length"],
};

export function getPresetMeasurementsForCategory(categoryPath: CategoryNode[]): string[] {
  for (let i = categoryPath.length - 1; i >= 0; i--) {
    const preset = PRESET_MEASUREMENTS_BY_CATEGORY[categoryPath[i].id];
    if (preset) return preset;
  }
  return [];
}

/** Exported only for categories.test.ts, which checks each key is a real category id. */
export const PRESET_MEASUREMENT_CATEGORY_IDS = Object.keys(PRESET_MEASUREMENTS_BY_CATEGORY);
