import type { SizeChartDefinition } from "@/lib/size-chart-config";

/** Either a number, or the specific reason there isn't one.
 *
 *  This used to just be `number | null`, and the UI only rendered its
 *  "Estimate weight" button when a number existed -- so every failure looked
 *  identical to the feature not being there at all. A seller with a suede
 *  jacket (deliberately unsupported, see NO_GSM_KEYWORDS) and a seller who
 *  simply hadn't filled in the size chart yet both saw exactly nothing. The
 *  reason string is written to be shown to a seller verbatim. */
export type WeightEstimate = { grams: number } | { grams: null; reason: string };

// Fabric weight in grams per square metre, keyed by normalized (lowercase,
// trimmed) fabric/material name -- sourced from apparel-industry GSM
// reference ranges, using the midpoint "practical default" for each. Ordered
// most-specific first: matching is substring-based, so "cotton twill" must
// be checked before the bare "cotton" fallback or it would never be reached.
// Real/faux distinction matters for leather: real leather and suede are
// tanned hide, not woven fabric, so GSM doesn't apply to them at all -- no
// entry means no auto-estimate, not a wrong one.
const GSM_KEYWORDS: { keywords: string[]; gsm: number }[] = [
  { keywords: ["heavy denim", "raw denim", "selvedge"], gsm: 450 },
  { keywords: ["denim"], gsm: 350 },
  { keywords: ["cotton twill", "twill"], gsm: 280 },
  { keywords: ["heavy cotton"], gsm: 240 },
  { keywords: ["cotton interlock"], gsm: 240 },
  { keywords: ["cotton pique", "pique"], gsm: 220 },
  { keywords: ["cotton rib"], gsm: 260 },
  { keywords: ["cotton poplin", "poplin", "shirting"], gsm: 150 },
  { keywords: ["cotton fleece"], gsm: 340 },
  { keywords: ["polyester fleece"], gsm: 300 },
  { keywords: ["fleece"], gsm: 340 },
  { keywords: ["french terry", "terry"], gsm: 300 },
  { keywords: ["polyester mesh", "mesh"], gsm: 140 },
  { keywords: ["polyester interlock"], gsm: 240 },
  { keywords: ["nylon", "activewear"], gsm: 230 },
  { keywords: ["spandex", "elastane", "stretch"], gsm: 230 },
  { keywords: ["cotton jersey", "jersey"], gsm: 180 },
  { keywords: ["faux leather", "pu leather", "pvc"], gsm: 800 },
  // West African fabrics. Ankara/wax print and batik are printed or dyed
  // cotton, and adire is a resist-dyeing technique applied to a cotton base,
  // so all three sit in cotton's range. Aso oke, kente and akwete are
  // deliberately absent: handwoven strip cloth varies far too much by weaver
  // and by whether it's beaten, and george varies with its beading and
  // embroidery -- a made-up midpoint for any of those would be worse than
  // the honest "we don't know how heavy that is yet".
  { keywords: ["guinea brocade", "brocade", "damask", "shadda"], gsm: 250 },
  { keywords: ["ankara", "wax print", "kitenge", "adire", "batik"], gsm: 200 },
  // Wovens and knits, lightest-first only where a substring would otherwise
  // shadow another entry.
  { keywords: ["organza"], gsm: 45 },
  { keywords: ["tulle", "net fabric"], gsm: 30 },
  { keywords: ["chiffon"], gsm: 60 },
  { keywords: ["georgette"], gsm: 80 },
  { keywords: ["satin", "charmeuse"], gsm: 90 },
  { keywords: ["crepe"], gsm: 120 },
  { keywords: ["lace"], gsm: 120 },
  { keywords: ["chambray"], gsm: 140 },
  { keywords: ["viscose", "rayon"], gsm: 140 },
  { keywords: ["modal"], gsm: 160 },
  { keywords: ["flannel"], gsm: 170 },
  { keywords: ["bamboo"], gsm: 180 },
  { keywords: ["acrylic"], gsm: 240 },
  { keywords: ["cashmere"], gsm: 250 },
  { keywords: ["velour", "velvet"], gsm: 300 },
  { keywords: ["corduroy", "cord"], gsm: 330 },
  { keywords: ["tweed"], gsm: 350 },
  { keywords: ["neoprene"], gsm: 500 },
  // Bare fibre names last: they're substrings of the compound names above
  // ("silk chiffon" is chiffon's 60, not silk's 110), so a generic match must
  // only be reached once every specific one has failed.
  { keywords: ["canvas"], gsm: 450 },
  { keywords: ["linen"], gsm: 180 },
  { keywords: ["silk"], gsm: 110 },
  { keywords: ["wool", "suiting"], gsm: 300 },
  { keywords: ["polyester"], gsm: 180 },
  { keywords: ["cotton blend"], gsm: 180 }, // overridden to 280 for bottoms, see guessGsm below
  { keywords: ["cotton"], gsm: 180 },
];

// Leather/suede are tanned hide, not a woven sheet -- there's no meaningful
// GSM for them, so they're excluded from GSM_KEYWORDS entirely and matched
// here first to short-circuit to "no estimate" rather than falling through
// to an unrelated fabric match.
const NO_GSM_KEYWORDS = ["suede", "leather"];

// Coated/bonded synthetics that merely have "leather" in the name. Real
// sheet goods with a real GSM, so they're checked before NO_GSM_KEYWORDS
// above rather than being caught by its "leather" substring.
const FAUX_LEATHER_KEYWORDS = ["faux leather", "pu leather", "vegan leather", "pvc", "vinyl"];

/** Guesses a fabric's weight in g/m² from a free-typed material name.
 *  `isBottom` only affects the "cotton blend" bucket, which genuinely
 *  differs by garment (a lighter jersey-weight blend on tops, a heavier
 *  twill-weight blend on trousers) per the sourced reference. Returns null
 *  when the name doesn't match anything, or names a non-textile (leather,
 *  suede) that GSM doesn't apply to. */
export function guessGsmForMaterial(material: string, isBottom: boolean): number | null {
  const name = material.trim().toLowerCase();
  if (!name) return null;
  // Coated synthetics MUST be tested before NO_GSM_KEYWORDS: "faux leather"
  // contains "leather", so with the checks the other way round this returned
  // null and both of its 800 gsm entries (here and in GSM_KEYWORDS) were
  // unreachable dead code -- only the bare "pvc" spelling ever worked.
  if (FAUX_LEATHER_KEYWORDS.some((kw) => name.includes(kw))) return 800;
  if (NO_GSM_KEYWORDS.some((kw) => name.includes(kw))) return null;
  if (name.includes("cotton blend")) return isBottom ? 280 : 180;
  for (const { keywords, gsm } of GSM_KEYWORDS) {
    if (keywords.some((kw) => name.includes(kw))) return gsm;
  }
  return null;
}

// Every guide that gets a trim/waste allowance and a fabric-area formula.
// Trim % is the midpoint of the sourced range (accounts for thread, seams,
// labels, and cutting waste on top of the raw fabric weight) -- deliberately
// not the full packaging allowance, which is a shipping-time concern applied
// separately, not a property of the garment itself.
const TRIM_MULTIPLIER: Record<SizeChartDefinition["guide"], number> = {
  tshirt: 1.065,
  polo: 1.1,
  "dress-shirt": 1.125,
  "off-shoulder-top": 1.065,
  "nfl-jersey": 1.1,
  "football-jersey": 1.1,
  "baggy-joggers": 1.1,
  "cuffed-joggers": 1.1,
  "straight-joggers": 1.1,
  "skinny-joggers": 1.1,
  "baggy-corporate-trousers": 1.16,
  "baggy-jeans": 1.16,
  shorts: 1.115,
  "jogger-jorts": 1.115,
  "denim-jorts": 1.115,
  "dolphin-shorts": 1.115,
  "bum-shorts": 1.115,
  "denim-bum-shorts": 1.115,
  "activewear-tshirt": 1.065,
  "standard-tshirt": 1.065,
  "polo-alt": 1.1,
  sweatshirt: 1.1,
  "basketball-jersey": 1.1,
  cardigan: 1.1,
  "cargo-pants": 1.16,
  "crop-top": 1.065,
  hoodie: 1.1,
  jumpsuit: 1.125,
  "mini-dress": 1.125,
  "mini-skirt": 1.1,
  "pleated-skirt": 1.1,
  "puffer-jacket": 1.2,
  romper: 1.125,
  "short-sleeve-shirt": 1.065,
  "sports-shorts": 1.115,
  "sweater-vest": 1.1,
  "tank-top": 1.065,
  "turtle-neck": 1.1,
  "varsity-jacket": 1.16,
};

// Fabric area formulas per garment shape, in m², from cm measurements --
// values already include front+back panels, sleeves where relevant, seam
// allowance and typical cutting waste. Every constant here is the midpoint
// of a sourced range, not a precision figure -- this whole module produces a
// starting suggestion for the seller to edit, never an authoritative number.
function topArea(chest: number, bodyLength: number, sleeve: number | undefined): number {
  const body = (2 * (chest + 8) * (bodyLength + 5)) / 10000;
  const sleeves = sleeve != null ? (2 * (sleeve + 5) * (chest / 4 + 5)) / 10000 : 0;
  return body + sleeves;
}

function bottomArea(waist: number, outseam: number, extra: number): number {
  return (2 * (waist + 8) * (outseam + 8)) / 10000 + extra;
}

/** A skirt is a single tube, not two legs: front and back panel only, so it
 *  reuses bottomArea's rectangle without the crotch/inseam allowance. Charts
 *  for skirts and sports shorts measure `length` rather than `outseam_length`
 *  (see letteredChart in size-chart-config.ts), which is why they can't share
 *  the trouser cases below. */
function skirtArea(waist: number, length: number, hipWidth: number | undefined): number {
  const widest = Math.max(waist, hipWidth ?? waist);
  return (2 * (widest + 8) * (length + 6)) / 10000;
}

/** Jumpsuits, rompers and dresses: one torso plus whatever hangs off it. The
 *  parts are the existing top and bottom rectangles with the same ease
 *  allowances -- composed, not re-derived, so a one-piece can never disagree
 *  with the separates it is made of. `body_length` on these charts is the
 *  torso to the waist, so it does not double-count the leg. */
function onePieceArea(
  chest: number,
  bodyLength: number,
  sleeve: number | undefined,
  hipWidth: number | undefined,
  inseam: number | undefined,
): number {
  const torso = topArea(chest, bodyLength, sleeve);
  if (inseam == null) return torso;
  const legs = (2 * ((hipWidth ?? chest) + 8) * (inseam + 8)) / 10000;
  return torso + legs;
}

function estimateAreaM2(
  guide: SizeChartDefinition["guide"],
  cm: Partial<Record<string, number>>,
): number | null {
  const {
    shoulder_width,
    chest_width,
    body_length,
    sleeve_length,
    waist_width,
    outseam_length,
    hip_width,
    inseam_length,
    length,
  } = cm as Record<string, number | undefined>;

  switch (guide) {
    // standard-tshirt/activewear-tshirt and polo-alt aren't different
    // garments -- they're the same shapes under a second chart id, drawn for
    // a different category, with byte-identical measurement lines
    // (STANDARD_TOP_LINES in size-chart-config.ts) and the same trim
    // multiplier. Leaving them out of this switch meant the single most
    // common product in the catalogue -- a plain t-shirt, which maps to
    // standard-tshirt -- could never be estimated at all.
    case "tshirt":
    case "standard-tshirt":
    case "activewear-tshirt":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length);
    case "polo":
    case "polo-alt":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length) * 1.1;
    // A dress shirt is cut as a looser button-through layer.
    case "dress-shirt": {
      if (chest_width == null || body_length == null) return null;
      const body = (2 * (chest_width + 10) * (body_length + 7)) / 10000;
      const sleeves =
        sleeve_length != null ? (2 * (sleeve_length + 7) * (chest_width / 4 + 6)) / 10000 : 0;
      return body + sleeves;
    }
    case "off-shoulder-top":
      if (chest_width == null || body_length == null) return null;
      return (2 * (chest_width + 8) * (body_length + 5) * 0.975) / 10000 + 0.075;
    case "nfl-jersey":
    case "football-jersey":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length) * 1.175 + 0.085;
    case "baggy-joggers":
    case "cuffed-joggers":
    case "straight-joggers":
    case "skinny-joggers":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.15);
    case "baggy-corporate-trousers":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.2);
    case "baggy-jeans":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.2) * 1.175;
    case "shorts":
    case "jogger-jorts":
    case "dolphin-shorts":
    case "bum-shorts":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.085);
    case "denim-jorts":
    case "denim-bum-shorts":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.085) * 1.175;
    // Every shape below arrived with the 2026-09-10 artwork batch. They were
    // given trim multipliers and guide images but no area formula, so the
    // estimator answered "we can't estimate this shape yet" for roughly half
    // the catalogue -- hoodies, tank tops, cargo pants and skirts included.
    //
    // Each is the generic top or bottom rectangle, not a new derivation:
    // where a garment's own construction differs (a puffer's loft, a
    // cardigan's open front) that difference lives in TRIM_MULTIPLIER and in
    // the fabric's GSM, both of which are already set per guide.
    case "sweatshirt":
    case "hoodie":
    case "cardigan":
    case "crop-top":
    case "short-sleeve-shirt":
    case "tank-top":
    case "sweater-vest":
    case "basketball-jersey":
    case "puffer-jacket":
    case "varsity-jacket":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length);
    // Trousers proper: this chart measures a real outseam, so it is the same
    // rectangle the joggers use.
    case "cargo-pants":
      if (waist_width == null || outseam_length == null) return null;
      return bottomArea(waist_width, outseam_length, 0.2);
    case "mini-skirt":
    case "pleated-skirt":
    case "sports-shorts":
      if (waist_width == null || length == null) return null;
      return skirtArea(waist_width, length, hip_width);
    case "jumpsuit":
    case "romper":
      if (chest_width == null || body_length == null) return null;
      return onePieceArea(chest_width, body_length, sleeve_length, hip_width, inseam_length);
    // A dress is a long top: body_length runs the full garment, and there is
    // no inseam to add. (bodycon-dress was dropped from the guide union in the
    // 2026-09-10 artwork pass -- if it returns, it belongs here.)
    case "mini-dress":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length);
    // turtle-neck is deliberately absent. Its chart measures shoulder, chest,
    // neck height, sleeve, cuff and hem -- but no body length, so there is no
    // way to size the front and back panels. Add body_length to that chart
    // and it becomes an ordinary top case.
    default:
      return null;
  }
}

const BOTTOM_GUIDES = new Set<SizeChartDefinition["guide"]>([
  "baggy-joggers",
  "cuffed-joggers",
  "straight-joggers",
  "skinny-joggers",
  "baggy-corporate-trousers",
  "baggy-jeans",
  "shorts",
  "jogger-jorts",
  "denim-jorts",
  "dolphin-shorts",
  "bum-shorts",
  "denim-bum-shorts",
]);

// Real weight units only -- a Weight/Volume option value in mL/L/fl oz has no
// fixed gram equivalent (depends on the product's density), so those are
// deliberately left out and parseWeightVolumeValueToGrams returns null for
// them rather than guessing.
const WEIGHT_UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

/** Parses a Weight/Volume option value ("2 lb", "500 g", a typed "2588 kg")
 *  into grams. Unlike estimateWeightGrams below, this isn't a guess -- the
 *  seller directly told us the weight by picking/typing this value, so it's
 *  used as a real (if still editable) starting number, not just a suggestion.
 *  Returns null for volume units and anything unparseable. */
export function parseWeightVolumeValueToGrams(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(.+)$/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;
  const perGram = WEIGHT_UNIT_TO_GRAMS[match[2].trim().toLowerCase()];
  if (perGram == null) return null;
  // 2 decimal places, not Math.round to the nearest whole gram -- "g" itself
  // has perGram=1, so rounding to an integer there silently zeroed out any
  // legitimately sub-gram value (e.g. "0.2 g" -> Math.round(0.2) -> 0, a
  // real product weight reported as weighing nothing). 2dp still cleans up
  // oz/lb's messy floating-point conversion noise (1 oz -> 28.349523125 ->
  // 28.35) without destroying a real fractional gram the seller typed.
  return Math.round(amount * perGram * 100) / 100;
}

// Which measurements each supported shape's formula actually reads, so a
// missing one can be named instead of just producing no estimate. Guides
// absent from this map have no area formula at all (corsets and bodysuits --
// boning, panelling and a gusset aren't the flat front/back rectangles the
// formulas above assume, and there's no sourced figure to model them with).
const REQUIRED_MEASUREMENTS: Partial<Record<SizeChartDefinition["guide"], string[]>> = {
  tshirt: ["chest_width", "body_length"],
  "standard-tshirt": ["chest_width", "body_length"],
  "activewear-tshirt": ["chest_width", "body_length"],
  polo: ["chest_width", "body_length"],
  "polo-alt": ["chest_width", "body_length"],
  "dress-shirt": ["chest_width", "body_length"],
  "off-shoulder-top": ["chest_width", "body_length"],
  "nfl-jersey": ["chest_width", "body_length"],
  "football-jersey": ["chest_width", "body_length"],
  "baggy-joggers": ["waist_width", "outseam_length"],
  "cuffed-joggers": ["waist_width", "outseam_length"],
  "straight-joggers": ["waist_width", "outseam_length"],
  "skinny-joggers": ["waist_width", "outseam_length"],
  "baggy-corporate-trousers": ["waist_width", "outseam_length"],
  "baggy-jeans": ["waist_width", "outseam_length"],
  shorts: ["waist_width", "outseam_length"],
  "jogger-jorts": ["waist_width", "outseam_length"],
  "denim-jorts": ["waist_width", "outseam_length"],
  "dolphin-shorts": ["waist_width", "outseam_length"],
  "bum-shorts": ["waist_width", "outseam_length"],
  "denim-bum-shorts": ["waist_width", "outseam_length"],
  // The 2026-09-10 artwork batch. Each entry names only what its own formula
  // reads, so a seller is told exactly which lettered row to go and fill in
  // rather than "we can't estimate this shape".
  sweatshirt: ["chest_width", "body_length"],
  hoodie: ["chest_width", "body_length"],
  cardigan: ["chest_width", "body_length"],
  "crop-top": ["chest_width", "body_length"],
  "short-sleeve-shirt": ["chest_width", "body_length"],
  "tank-top": ["chest_width", "body_length"],
  "sweater-vest": ["chest_width", "body_length"],
  "basketball-jersey": ["chest_width", "body_length"],
  "puffer-jacket": ["chest_width", "body_length"],
  "varsity-jacket": ["chest_width", "body_length"],
  "mini-dress": ["chest_width", "body_length"],
  jumpsuit: ["chest_width", "body_length"],
  romper: ["chest_width", "body_length"],
  "cargo-pants": ["waist_width", "outseam_length"],
  "mini-skirt": ["waist_width", "length"],
  "pleated-skirt": ["waist_width", "length"],
  "sports-shorts": ["waist_width", "length"],
  // turtle-neck is deliberately absent: its chart has no body_length, so
  // there is nothing to size the panels from. See estimateAreaM2.
};

const MEASUREMENT_NAMES: Record<string, string> = {
  chest_width: "chest width",
  body_length: "body length",
  waist_width: "waist width",
  outseam_length: "outseam length",
  hip_width: "hip width",
  inseam_length: "inseam length",
  length: "length",
  hem_width: "hem width",
  shoulder_width: "shoulder width",
  sleeve_length: "sleeve length",
};

// The size chart labels its rows with the bare letter off the guide image
// ("a", "b", ...), never a name -- so a message that only says "chest width"
// leaves the seller hunting. Name both.
function describeMeasurement(chart: SizeChartDefinition, key: string): string {
  const name = MEASUREMENT_NAMES[key] ?? key.replace(/_/g, " ");
  const letter = chart.lines.find((l) => l.key === key)?.label;
  return letter ? `${letter} (${name})` : name;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Rough shipping-weight estimate in grams, from a category's chart shape,
 *  one size's cm measurements, and a free-typed material name -- or the
 *  specific reason there isn't one, phrased for the seller to read.
 *
 *  Deliberately never guesses past a missing input: an estimate the seller
 *  can't trace back to their own numbers is worse than no estimate, because
 *  it silently becomes the weight a courier quotes against. */
export function estimateWeight(
  chart: SizeChartDefinition | null,
  measurementsCm: Partial<Record<string, number>>,
  material: string,
): WeightEstimate {
  if (!chart) {
    return {
      grams: null,
      reason:
        "There's no size guide for this category yet, so there are no measurements to work from. Weigh one and type it in.",
    };
  }

  const required = REQUIRED_MEASUREMENTS[chart.guide];
  if (!required) {
    return {
      grams: null,
      reason:
        "We can't estimate this shape yet — its panels aren't a simple front and back. Weigh one and type it in.",
    };
  }

  const missing = required.filter((key) => measurementsCm[key] == null);
  if (missing.length > 0) {
    return {
      grams: null,
      reason: `Add ${joinWithAnd(missing.map((k) => describeMeasurement(chart, k)))} for this size in the size chart, then try again.`,
    };
  }

  const areaM2 = estimateAreaM2(chart.guide, measurementsCm);
  if (areaM2 == null) {
    return { grams: null, reason: "We couldn't work out the fabric area from these measurements." };
  }

  const name = material.trim();
  if (!name) {
    return {
      grams: null,
      reason: "Add the material first — the estimate works from how heavy that fabric is.",
    };
  }

  const gsm = guessGsmForMaterial(name, BOTTOM_GUIDES.has(chart.guide));
  if (gsm == null) {
    const lower = name.toLowerCase();
    if (NO_GSM_KEYWORDS.some((kw) => lower.includes(kw))) {
      return {
        grams: null,
        reason: `${name} is sold by the hide, not by fabric weight, so there's no honest way to estimate it. Weigh one and type it in.`,
      };
    }
    return {
      grams: null,
      reason: `We don't know how heavy "${name}" is yet. Weigh one and type it in.`,
    };
  }

  const trim = TRIM_MULTIPLIER[chart.guide] ?? 1.1;
  return { grams: Math.round((areaM2 * gsm * trim) / 5) * 5 };
}
