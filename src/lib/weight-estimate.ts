import type { SizeChartDefinition } from "@/lib/size-chart-config";

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

/** Guesses a fabric's weight in g/m² from a free-typed material name.
 *  `isBottom` only affects the "cotton blend" bucket, which genuinely
 *  differs by garment (a lighter jersey-weight blend on tops, a heavier
 *  twill-weight blend on trousers) per the sourced reference. Returns null
 *  when the name doesn't match anything, or names a non-textile (leather,
 *  suede) that GSM doesn't apply to. */
export function guessGsmForMaterial(material: string, isBottom: boolean): number | null {
  const name = material.trim().toLowerCase();
  if (!name) return null;
  if (NO_GSM_KEYWORDS.some((kw) => name.includes(kw))) return null;
  if (name.includes("faux leather") || name.includes("pu leather")) return 800;
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
  "clothing-corset": 1.16,
  "clothing-bodysuit": 1.1,
  overshirt: 1.125,
  sweatshirt: 1.1,
  "lingerie-corset": 1.16,
  "lingerie-bodysuit": 1.1,
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

function estimateAreaM2(
  guide: SizeChartDefinition["guide"],
  cm: Partial<Record<string, number>>,
): number | null {
  const { shoulder_width, chest_width, body_length, sleeve_length, waist_width, outseam_length } =
    cm as Record<string, number | undefined>;

  switch (guide) {
    case "tshirt":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length);
    case "polo":
      if (chest_width == null || body_length == null) return null;
      return topArea(chest_width, body_length, sleeve_length) * 1.1;
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
  return Math.round(amount * perGram);
}

/** Rough shipping-weight estimate in grams, from a category's chart shape,
 *  one size's cm measurements, and a free-typed material name. Returns null
 *  whenever any required input is missing or unrecognized -- callers should
 *  treat that as "no suggestion available", not zero. */
export function estimateWeightGrams(
  guide: SizeChartDefinition["guide"],
  measurementsCm: Partial<Record<string, number>>,
  material: string,
): number | null {
  const areaM2 = estimateAreaM2(guide, measurementsCm);
  if (areaM2 == null) return null;
  const gsm = guessGsmForMaterial(material, BOTTOM_GUIDES.has(guide));
  if (gsm == null) return null;
  const trim = TRIM_MULTIPLIER[guide] ?? 1.1;
  const grams = areaM2 * gsm * trim;
  return Math.round(grams / 5) * 5;
}
