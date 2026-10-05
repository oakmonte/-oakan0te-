import type { SizeChartDefinition } from "@/lib/size-chart-config";

/** Either a number, or the specific reason there isn't one.
 *
 *  This used to just be `number | null`, and the UI only rendered its
 *  "Estimate weight" button when a number existed -- so every failure looked
 *  identical to the feature not being there at all. The reason string is
 *  written to be shown to a seller verbatim. */
export type WeightEstimate = { grams: number } | { grams: null; reason: string };

type Guide = SizeChartDefinition["guide"];

/** Which weight a fabric named only by its fibre ("cotton", "polyester")
 *  most likely is. A seller who types "cotton" for a t-shirt means jersey, for
 *  trousers means twill or drill, and for a hoodie means fleece -- three
 *  fabrics nearly 2x apart. Named fabrics ("poplin", "denim") ignore this. */
export type FabricContext = "top" | "bottom" | "fleece";

// Fabric weight in grams per square metre, keyed by lowercase name. Values
// are the common middle of each fabric's trade range (e.g. jersey 140-220,
// denim 300-500). Matching is by word start ("lace" matches "lace" and
// "lacework", not "necklace"), most specific first: "silk chiffon" must hit
// chiffon's 60 before the bare "silk" fallback.
const GSM_KEYWORDS: { keywords: string[]; gsm: number }[] = [
  // Coated and imitation leathers are sheet goods with a real per-area
  // weight, and contain "leather"/"suede", so they precede the hides below.
  { keywords: ["faux suede", "microsuede", "vegan suede"], gsm: 280 },
  { keywords: ["faux leather", "pu leather", "vegan leather", "pleather"], gsm: 550 },
  { keywords: ["pvc", "vinyl"], gsm: 600 },
  // Hides. Leather is sold by area and thickness, and a hide is roughly as
  // dense as water (0.8-1.0 g/cm³), so thickness pins the weight: garment
  // lambskin is ~0.7 mm, cowhide 1.0-1.3 mm.
  { keywords: ["shearling"], gsm: 1300 },
  { keywords: ["lambskin", "lamb leather", "nappa"], gsm: 650 },
  { keywords: ["sheepskin"], gsm: 700 },
  { keywords: ["goatskin", "goat leather"], gsm: 750 },
  { keywords: ["cowhide", "cow leather", "buffalo"], gsm: 1100 },
  { keywords: ["patent leather"], gsm: 950 },
  { keywords: ["nubuck"], gsm: 900 },
  { keywords: ["suede"], gsm: 700 },
  { keywords: ["leather"], gsm: 900 },

  { keywords: ["heavy denim", "raw denim", "selvedge", "selvage"], gsm: 450 },
  { keywords: ["stretch denim"], gsm: 340 },
  { keywords: ["denim"], gsm: 380 },
  { keywords: ["chino", "drill", "gabardine"], gsm: 260 },
  { keywords: ["cotton twill", "twill"], gsm: 260 },
  { keywords: ["heavy cotton", "heavyweight cotton"], gsm: 240 },
  { keywords: ["cotton interlock", "interlock"], gsm: 220 },
  { keywords: ["cotton pique", "pique"], gsm: 220 },
  { keywords: ["cotton rib", "rib knit", "ribbed"], gsm: 240 },
  { keywords: ["waffle"], gsm: 220 },
  { keywords: ["oxford"], gsm: 155 },
  { keywords: ["cotton poplin", "poplin", "shirting", "broadcloth"], gsm: 125 },
  { keywords: ["seersucker"], gsm: 120 },
  { keywords: ["lawn", "voile", "muslin", "gauze", "cheesecloth"], gsm: 85 },
  { keywords: ["sherpa", "teddy", "borg"], gsm: 380 },
  { keywords: ["loopback", "heavyweight fleece"], gsm: 400 },
  { keywords: ["cotton fleece", "brushed fleece"], gsm: 330 },
  { keywords: ["polar fleece", "polyester fleece", "microfleece"], gsm: 250 },
  { keywords: ["fleece"], gsm: 320 },
  { keywords: ["french terry", "terry"], gsm: 300 },
  { keywords: ["scuba"], gsm: 330 },
  { keywords: ["ponte"], gsm: 300 },
  { keywords: ["polyester mesh", "mesh", "eyelet"], gsm: 140 },
  { keywords: ["ripstop", "taffeta"], gsm: 80 },
  { keywords: ["softshell"], gsm: 300 },
  { keywords: ["lycra", "spandex", "elastane", "stretch", "activewear"], gsm: 230 },
  { keywords: ["cotton jersey", "jersey", "single jersey"], gsm: 170 },
  // West African fabrics. Ankara/wax print and batik are printed or dyed
  // cotton, and adire is a resist-dyeing technique applied to a cotton base,
  // so all three sit in cotton's range. Senator is a cotton-polyester suiting.
  // Aso oke, kente and akwete are deliberately absent: handwoven strip cloth
  // varies far too much by weaver and by whether it's beaten, and george
  // varies with its beading -- a made-up midpoint for any of those would be
  // worse than the honest "we don't know how heavy that is yet".
  { keywords: ["guinea brocade", "brocade", "damask", "shadda", "jacquard"], gsm: 250 },
  { keywords: ["ankara", "wax print", "kitenge", "adire", "batik"], gsm: 200 },
  { keywords: ["senator"], gsm: 190 },
  { keywords: ["organza"], gsm: 45 },
  { keywords: ["tulle", "net fabric"], gsm: 30 },
  { keywords: ["chiffon"], gsm: 60 },
  { keywords: ["georgette"], gsm: 80 },
  { keywords: ["crepe de chine"], gsm: 90 },
  { keywords: ["satin", "charmeuse"], gsm: 90 },
  { keywords: ["crepe"], gsm: 160 },
  { keywords: ["lace"], gsm: 120 },
  { keywords: ["chambray"], gsm: 140 },
  { keywords: ["viscose", "rayon", "tencel", "lyocell"], gsm: 140 },
  { keywords: ["modal"], gsm: 160 },
  { keywords: ["flannel"], gsm: 180 },
  { keywords: ["bamboo"], gsm: 180 },
  { keywords: ["neoprene"], gsm: 500 },
  { keywords: ["melton", "boiled wool"], gsm: 550 },
  { keywords: ["boucle", "chenille"], gsm: 380 },
  { keywords: ["cable knit", "chunky knit"], gsm: 480 },
  { keywords: ["velour", "velvet"], gsm: 280 },
  { keywords: ["corduroy"], gsm: 320 },
  { keywords: ["tweed"], gsm: 350 },
  { keywords: ["canvas", "duck"], gsm: 400 },
  // Bare fibre names last: each is a word inside the compound names above.
  { keywords: ["acrylic"], gsm: 260 },
  { keywords: ["cashmere"], gsm: 250 },
  { keywords: ["linen"], gsm: 180 },
  { keywords: ["silk"], gsm: 100 },
  { keywords: ["wool", "suiting", "merino"], gsm: 280 },
];

// A bare fibre says nothing about the fabric's construction, so its weight
// comes from what the garment usually is (see FabricContext).
const GENERIC_FIBRE_GSM: { keywords: string[]; gsm: Record<FabricContext, number> }[] = [
  { keywords: ["cotton"], gsm: { top: 175, bottom: 260, fleece: 320 } },
  { keywords: ["polyester", "poly"], gsm: { top: 150, bottom: 220, fleece: 260 } },
  { keywords: ["nylon"], gsm: { top: 180, bottom: 200, fleece: 250 } },
];

function hasWord(name: string, keyword: string): boolean {
  const i = name.indexOf(keyword);
  if (i < 0) return false;
  // Word start only: "lace" must not match "necklace", but plurals and
  // suffixes ("laces", "lacework") still do.
  if (i === 0 || !/[a-z]/.test(name[i - 1])) return true;
  return hasWord(name.slice(i + 1), keyword);
}

/** Guesses a fabric's weight in g/m² from a free-typed material name, or
 *  null when it doesn't recognise it. A blend ("60% cotton 40% polyester")
 *  resolves by its first named fabric. */
export function guessGsmForMaterial(
  material: string,
  context: FabricContext = "top",
): number | null {
  const name = material.trim().toLowerCase();
  if (!name) return null;
  for (const { keywords, gsm } of GSM_KEYWORDS) {
    if (keywords.some((kw) => hasWord(name, kw))) return gsm;
  }
  // Fibres are tried in the order they appear in the name, so a blend takes
  // the weight of its main fibre.
  let best: { at: number; gsm: number } | null = null;
  for (const { keywords, gsm } of GENERIC_FIBRE_GSM) {
    for (const kw of keywords) {
      const at = name.indexOf(kw);
      if (at >= 0 && hasWord(name, kw) && (!best || at < best.at)) {
        best = { at, gsm: gsm[context] };
      }
    }
  }
  return best?.gsm ?? null;
}

// ---------------------------------------------------------------------------
// Garment construction
//
// The weight is what ships: the garment's own fabric, its lining and fill,
// and its notions (zips, buttons, rivets, rib trims, labels, thread). It is
// NOT the fabric bought to cut it -- the cutting waste stays on the factory
// floor, so the old flat "trim multiplier" overstated light garments and
// still missed everything a jacket is actually made of.
//
// Every measurement is a flat (laid-out) width in cm, as the size guides
// draw them. Areas are m². Pattern ratios below were checked against
// measured garments: a 180 gsm tee M (51 cm chest, 74 cm long) at ~175 g, a
// 270 gsm pullover hoodie M at ~530 g, 12 oz jeans W32 at ~600 g, a pique
// polo M at ~225 g, a poplin shirt M at ~230 g, nylon-spandex leggings at
// ~200 g. See weight-estimate.test.ts for the full reference set.
// ---------------------------------------------------------------------------

const LINING_GSM = 65; // polyester taffeta/satin lining
const POCKETING_GSM = 120; // poly-cotton pocket bags
const INTERLINING_GSM = 300; // corset coutil

type Build = {
  /** m² of the seller's own fabric. */
  main: number;
  /** m² of light lining. */
  lining?: number;
  /** m² of pocket-bag cloth. */
  pocketing?: number;
  /** m² of stiff interlining. */
  interlining?: number;
  /** grams of insulation (down or synthetic wadding). */
  fill?: number;
  /** grams of zips, buttons, rivets, rib trims, elastic, labels and thread. */
  notions: number;
};

const m2 = (cm2: number) => cm2 / 10000;

/** Front and back panels. `width` is the flat chest (or the average flat
 *  width for a flared garment); neckline and armholes are cut out of the
 *  rectangle, more so with no sleeve set into them. */
function panels(width: number, length: number, sleeveless: boolean): number {
  return m2(2 * (width + 2) * (length + 3) * (sleeveless ? 0.88 : 0.93));
}

/** Two sleeves. A sleeve is a tube: its flat bicep is ~40% of the flat chest
 *  and it is cut double that wide. The cap curve and the taper to the cuff
 *  take more off a long sleeve than a short one. */
function sleeves(chest: number, sleeve: number | undefined): number {
  if (sleeve == null || sleeve <= 0) return 0;
  const taper = sleeve < 35 ? 0.9 : 0.75;
  return m2(2 * (2 * 0.4 * chest) * (sleeve + 3) * taper);
}

function top(chest: number, length: number, sleeve: number | undefined): number {
  return panels(chest, length, sleeve == null) + sleeves(chest, sleeve);
}

/** Flat rise (waist to crotch), for charts that measure the inseam only. */
const rise = (waist: number) => Math.max(18, 0.62 * waist);

/** Two legs plus a double-layer waistband. Each leg is cut as a front and a
 *  back panel: at the top they span the hip plus the crotch extensions
 *  (~30% of the flat hip), at the hem the full leg opening. Thigh-to-knee
 *  stays near the top width, so the average is weighted 60/40 toward it. */
function legs(
  waist: number,
  outseam: number,
  opts: { hip?: number; legOpening?: number; hipRatio?: number; hemRatio?: number } = {},
): number {
  const hip = opts.hip ?? waist * (opts.hipRatio ?? 1.25);
  const topWidth = 1.3 * hip;
  const hemWidth = opts.legOpening != null ? 2 * opts.legOpening : (opts.hemRatio ?? 0.75) * hip;
  const leg = 0.6 * topWidth + 0.4 * hemWidth;
  return m2(2 * leg * (outseam + 4)) + m2(2 * (waist + 2) * 8);
}

/** A skirt (or a dress below the waist) is one tube from waist to hem. */
function tube(topFlat: number, hemFlat: number, length: number): number {
  return m2(((2 * topFlat + 2 * hemFlat) / 2) * (length + 4));
}

type Cm = Partial<Record<string, number>>;

// A size guide draws flat widths, but some sellers type the full
// circumference off a tape. No adult garment lies flat wider than these, so
// anything above is a circumference and is halved.
const CIRCUMFERENCE_OVER: Record<string, number> = {
  chest_width: 85,
  waist_width: 80,
  hip_width: 90,
};

function normalise(cm: Cm): Cm {
  const out: Cm = {};
  for (const [key, value] of Object.entries(cm)) {
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    const over = CIRCUMFERENCE_OVER[key];
    out[key] = over != null && value > over ? value / 2 : value;
  }
  return out;
}

/** The materials a garment is built from, per shape. null when a required
 *  measurement is missing (REQUIRED_MEASUREMENTS names which). */
function build(guide: Guide, cm: Cm): Build | null {
  const chest = cm.chest_width;
  const len = cm.body_length;
  const sleeve = cm.sleeve_length;
  const waist = cm.waist_width;
  const hip = cm.hip_width;
  const hem = cm.hem_width;
  const outseam = cm.outseam_length;
  const inseam = cm.inseam_length;
  const opening = cm.leg_opening;

  const needTop = chest != null && len != null;
  switch (guide) {
    // ---- Knit tops ------------------------------------------------------
    case "tshirt":
    case "standard-tshirt":
    case "activewear-tshirt":
    case "compression-shirt":
    case "crop-top":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve), notions: 6 }; // neck rib, label, thread
    case "henley":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve) + 0.02, notions: 9 }; // placket, 3 buttons
    case "tunic":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve), notions: 6 };
    case "tank-top":
      if (!needTop) return null;
      return { main: panels(chest, len, true), notions: 4 };
    case "polo":
    case "polo-alt":
      if (!needTop) return null;
      // Flat-knit collar and two-layer placket.
      return { main: top(chest, len, sleeve) + 0.045, notions: 9 };
    case "off-shoulder-top":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve), notions: 10 }; // elasticated neckline
    case "peplum-top":
      if (!needTop) return null;
      // The peplum is a flared ruffle ~1.5x the waist, ~15 cm deep.
      return { main: top(chest, len, sleeve) + m2(2 * 1.5 * chest * 18), notions: 10 };
    case "turtle-neck":
      if (!needTop) return null;
      // Doubled neck tube: ~40% of the flat chest across, folded over.
      return {
        main: top(chest, len, sleeve) + m2(2 * 0.4 * chest * 2 * ((cm.neck_height ?? 12) + 2)),
        notions: 6,
      };
    case "nfl-jersey":
    case "football-jersey":
    case "basketball-jersey":
      if (!needTop) return null;
      // Numbers and crests: heat-pressed twill on an NFL jersey is heavy.
      return {
        main: guide === "basketball-jersey" ? panels(chest, len, true) : top(chest, len, sleeve),
        notions: guide === "nfl-jersey" ? 45 : 12,
      };

    // ---- Sweats and knitwear ---------------------------------------------
    case "sweatshirt":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve), notions: 12 }; // rib cuffs, hem, collar
    case "hoodie":
      if (!needTop) return null;
      // Two-panel hood (lined hoods are doubled; the midpoint is ~0.27 m²)
      // and a kangaroo pocket.
      return { main: top(chest, len, sleeve) + 0.27 + 0.06, notions: 18 };
    case "cardigan":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve) + 0.03, notions: 14 }; // button bands
    case "sweater-vest":
      if (!needTop) return null;
      return { main: panels(chest, len, true), notions: 8 };

    // ---- Woven shirts -------------------------------------------------------
    case "dress-shirt":
    case "short-sleeve-shirt":
      if (!needTop) return null;
      // Collar, stand, cuffs, placket and yoke are all doubled or interfaced.
      return {
        main: top(chest, len, sleeve) + (guide === "dress-shirt" ? 0.12 : 0.08),
        notions: 12,
      };
    case "senator-wear": {
      if (!needTop) return null;
      // Senator is sold as a set: the long top plus matching trousers, sized
      // from the top (a flat waist is ~85% of the flat chest; the trousers run
      // ~1.45x the top's length).
      const trousers = legs(0.85 * chest, 1.45 * len);
      return { main: top(chest, len, sleeve) + 0.06 + trousers, notions: 25 };
    }

    // ---- Outerwear ----------------------------------------------------------
    case "puffer-jacket": {
      if (!needTop) return null;
      // Baffles bulge, so the shell is ~15% more than the flat pattern; the
      // lining matches the pattern; synthetic or down fill averages ~260 g/m².
      const pattern = top(chest, len, sleeve) + 0.05;
      return { main: pattern * 1.15, lining: pattern, fill: pattern * 260, notions: 50 };
    }
    case "gilet": {
      if (!needTop) return null;
      const pattern = panels(chest, len, true) + 0.04;
      return { main: pattern * 1.1, lining: pattern, fill: pattern * 200, notions: 35 };
    }
    case "parka": {
      if (!needTop) return null;
      // Hood, storm flap, big pockets; lighter wadding than a puffer.
      const pattern = top(chest, len, sleeve) + 0.3 + 0.12;
      return { main: pattern, lining: pattern, fill: pattern * 150, notions: 90 };
    }
    case "varsity-jacket": {
      if (!needTop) return null;
      // Quilted lining is about 1.6x a plain one; heavy rib collar, cuffs and
      // hem plus snap buttons.
      const pattern = top(chest, len, sleeve);
      return { main: pattern, lining: pattern * 1.6, notions: 95 };
    }
    case "leather-jacket": {
      if (!needTop) return null;
      // Lapels and pockets; zips and studs on a biker are heavy.
      const pattern = top(chest, len, sleeve) + 0.1;
      return { main: pattern, lining: pattern, notions: 110 };
    }
    case "trucker-jacket":
      if (!needTop) return null;
      // Collar, yokes, chest pockets and button plackets; metal shank buttons.
      return { main: top(chest, len, sleeve) + 0.25, notions: 35 };
    case "track-jacket":
      if (!needTop) return null;
      return { main: top(chest, len, sleeve) + 0.04, notions: 30 }; // full zip

    // ---- Dresses and one-pieces ---------------------------------------------
    case "mini-dress":
    case "off-shoulder-dress":
    case "slip-dress":
    case "wrap-dress":
    case "shirt-dress":
    case "a-line-dress": {
      if (!needTop) return null;
      // Body length runs the full dress. The skirt flares from the widest of
      // chest and hip to the hem (a measured hem, or a gentle default flare).
      const widest = Math.max(chest, hip ?? chest);
      const hemFlat = hem ?? widest * (guide === "a-line-dress" ? 1.4 : 1.1);
      const width = (chest + widest + hemFlat) / 3 + (guide === "wrap-dress" ? 0.25 * chest : 0);
      const main =
        panels(width, len, sleeve == null || guide === "slip-dress") + sleeves(chest, sleeve);
      const extra = guide === "shirt-dress" ? 0.1 : 0;
      const notions = guide === "shirt-dress" ? 14 : guide === "wrap-dress" ? 6 : 12; // zip
      return { main: main + extra, notions };
    }
    case "jumpsuit":
    case "romper": {
      if (!needTop) return null;
      // body_length on these charts is the torso to the waist.
      const torso = top(chest, len, sleeve);
      const w = waist ?? 0.85 * chest;
      const legLength = inseam != null ? inseam + rise(w) : guide === "romper" ? 35 : 95;
      return { main: torso + legs(w, legLength, { hip }), notions: 18 };
    }
    case "corset": {
      if (!needTop) return null;
      // Fashion fabric over coutil, with boning, a busk or zip and lacing.
      const area = m2(2 * ((chest + (waist ?? 0.8 * chest)) / 2 + 2) * (len + 3) * 0.95);
      return { main: area, interlining: area, notions: 55 };
    }
    case "sports-bra":
      if (!needTop) return null;
      // Self-lined front and back plus an underband.
      return { main: m2(2 * chest * len * 0.75) * 2, notions: 15 };

    // ---- Trousers -----------------------------------------------------------
    case "baggy-joggers":
    case "cuffed-joggers":
    case "straight-joggers":
    case "skinny-joggers":
      if (waist == null || outseam == null) return null;
      // Elasticated waists measure small for the hip they sit over.
      return {
        main:
          legs(waist, outseam, {
            legOpening: opening,
            hipRatio: 1.3,
            hemRatio: guide === "baggy-joggers" ? 0.85 : 0.55,
          }) + 0.06,
        notions: 14,
      };
    case "baggy-corporate-trousers":
      if (waist == null || outseam == null) return null;
      return {
        main: legs(waist, outseam, { legOpening: opening, hemRatio: 0.85 }) + 0.04,
        pocketing: 0.14,
        notions: 18,
      };
    case "baggy-jeans":
      if (waist == null || outseam == null) return null;
      // Back and coin pockets, belt loops; rivets, shank button, zip, patch.
      return {
        main: legs(waist, outseam, { legOpening: opening, hemRatio: 0.85 }) + 0.08,
        pocketing: 0.14,
        notions: 28,
      };
    case "cargo-pants":
      if (waist == null || outseam == null) return null;
      return {
        main: legs(waist, outseam, { hip, legOpening: opening, hemRatio: 0.8 }) + 0.25,
        pocketing: 0.12,
        notions: 25,
      };
    case "leggings":
    case "flared-pants":
    case "harem-pants":
    case "leather-pants":
    case "linen-pants":
    case "palazzo":
    case "parachute-pants": {
      if (waist == null || inseam == null) return null;
      const notions: Partial<Record<Guide, number>> = {
        leggings: 4,
        "leather-pants": 22,
        "parachute-pants": 28,
        "flared-pants": 12,
      };
      const lined = guide === "leather-pants";
      const main =
        legs(waist, inseam + rise(waist), {
          hip,
          legOpening: opening,
          hipRatio: guide === "leggings" ? 1.2 : 1.25,
          hemRatio: guide === "palazzo" ? 1.3 : 0.75,
        }) + (guide === "parachute-pants" ? 0.1 : 0);
      return { main, lining: lined ? main * 0.5 : 0, notions: notions[guide] ?? 10 };
    }

    // ---- Shorts -------------------------------------------------------------
    case "shorts":
    case "bermuda-shorts":
    case "denim-jorts":
    case "denim-bum-shorts":
      if (waist == null || outseam == null) return null;
      return {
        main: legs(waist, outseam, { hip, legOpening: opening, hemRatio: 1.1 }) + 0.05,
        pocketing: 0.1,
        notions: guide.startsWith("denim") ? 22 : 14,
      };
    case "jogger-jorts":
    case "dolphin-shorts":
    case "bum-shorts":
    case "biker-shorts":
      if (waist == null || outseam == null) return null;
      return {
        main: legs(waist, outseam, {
          hip,
          legOpening: opening,
          hipRatio: guide === "jogger-jorts" ? 1.3 : 1.2,
          hemRatio: guide === "biker-shorts" ? 0.75 : 1.1,
        }),
        notions: guide === "jogger-jorts" ? 12 : 5,
      };
    case "sports-shorts":
      if (waist == null || cm.length == null) return null;
      // Usually with a brief liner, about a quarter of the shell.
      return {
        main: legs(waist, cm.length, { hip, legOpening: opening, hemRatio: 1.1 }) * 1.25,
        notions: 10,
      };

    // ---- Skirts -------------------------------------------------------------
    case "mini-skirt":
    case "pleated-skirt": {
      if (waist == null || cm.length == null) return null;
      const widest = Math.max(waist, hip ?? waist * 1.25);
      const shell = tube(widest, hem ?? widest * 1.15, cm.length);
      // Knife and box pleats fold ~2.5x the visible width into the skirt.
      const pleated = guide === "pleated-skirt" ? 2.5 : 1;
      return { main: shell * pleated + m2(2 * (waist + 2) * 8), notions: 10 };
    }
  }
  return null;
}

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

// Which measurements each shape's construction reads, so a missing one can
// be named instead of just producing no estimate. Every guide is here: the
// guard test in weight-estimate.test.ts fails if a new one isn't.
const TOP = ["chest_width", "body_length"];
const OUTSEAM = ["waist_width", "outseam_length"];
const INSEAM = ["waist_width", "inseam_length"];
const SKIRT = ["waist_width", "length"];
const REQUIRED_MEASUREMENTS: Record<Guide, string[]> = {
  tshirt: TOP,
  "standard-tshirt": TOP,
  "activewear-tshirt": TOP,
  "compression-shirt": TOP,
  "crop-top": TOP,
  henley: TOP,
  tunic: TOP,
  "tank-top": TOP,
  polo: TOP,
  "polo-alt": TOP,
  "off-shoulder-top": TOP,
  "peplum-top": TOP,
  "turtle-neck": TOP,
  "nfl-jersey": TOP,
  "football-jersey": TOP,
  "basketball-jersey": TOP,
  sweatshirt: TOP,
  hoodie: TOP,
  cardigan: TOP,
  "sweater-vest": TOP,
  "dress-shirt": TOP,
  "short-sleeve-shirt": TOP,
  "senator-wear": TOP,
  "puffer-jacket": TOP,
  gilet: TOP,
  parka: TOP,
  "varsity-jacket": TOP,
  "leather-jacket": TOP,
  "trucker-jacket": TOP,
  "track-jacket": TOP,
  "mini-dress": TOP,
  "off-shoulder-dress": TOP,
  "slip-dress": TOP,
  "wrap-dress": TOP,
  "shirt-dress": TOP,
  "a-line-dress": TOP,
  jumpsuit: TOP,
  romper: TOP,
  corset: TOP,
  "sports-bra": TOP,
  "baggy-joggers": OUTSEAM,
  "cuffed-joggers": OUTSEAM,
  "straight-joggers": OUTSEAM,
  "skinny-joggers": OUTSEAM,
  "baggy-corporate-trousers": OUTSEAM,
  "baggy-jeans": OUTSEAM,
  "cargo-pants": OUTSEAM,
  shorts: OUTSEAM,
  "bermuda-shorts": OUTSEAM,
  "denim-jorts": OUTSEAM,
  "denim-bum-shorts": OUTSEAM,
  "jogger-jorts": OUTSEAM,
  "dolphin-shorts": OUTSEAM,
  "bum-shorts": OUTSEAM,
  "biker-shorts": OUTSEAM,
  leggings: INSEAM,
  "flared-pants": INSEAM,
  "harem-pants": INSEAM,
  "leather-pants": INSEAM,
  "linen-pants": INSEAM,
  palazzo: INSEAM,
  "parachute-pants": INSEAM,
  "sports-shorts": SKIRT,
  "mini-skirt": SKIRT,
  "pleated-skirt": SKIRT,
};

// What a bare fibre name most likely means for each garment (see
// FabricContext). Anything not listed is "top".
const FLEECE_GUIDES = new Set<Guide>([
  "hoodie",
  "sweatshirt",
  "baggy-joggers",
  "cuffed-joggers",
  "straight-joggers",
  "skinny-joggers",
  "jogger-jorts",
]);
const BOTTOMWEIGHT_GUIDES = new Set<Guide>([
  "baggy-corporate-trousers",
  "baggy-jeans",
  "cargo-pants",
  "shorts",
  "bermuda-shorts",
  "denim-jorts",
  "denim-bum-shorts",
  "flared-pants",
  "parachute-pants",
  "mini-skirt",
  "pleated-skirt",
  "trucker-jacket",
  "varsity-jacket",
  "parka",
]);

function fabricContext(guide: Guide): FabricContext {
  if (FLEECE_GUIDES.has(guide)) return "fleece";
  if (BOTTOMWEIGHT_GUIDES.has(guide)) return "bottom";
  return "top";
}

// A puffer or gilet "in nylon" or "in polyester" means a light ripstop or
// taffeta shell (40-100 gsm), not the 150-230 gsm knits those fibre names
// mean on a t-shirt -- the bulk is the fill, counted separately.
const LIGHT_SHELL_GUIDES = new Set<Guide>(["puffer-jacket", "gilet"]);
const LIGHT_SHELL_GSM = 80;
const MELTON_GSM = 550;

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

/** Estimated weight of the garment itself in grams (not its packaging),
 *  from its shape, one size's measurements and a free-typed material -- or
 *  the specific reason there isn't one, phrased for the seller to read.
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

  const cm = normalise(measurementsCm);
  const required = REQUIRED_MEASUREMENTS[chart.guide] ?? [];
  const missing = required.filter((key) => cm[key] == null);
  if (missing.length > 0) {
    return {
      grams: null,
      reason: `Add ${joinWithAnd(missing.map((k) => describeMeasurement(chart, k)))} for this size in the size chart, then try again.`,
    };
  }

  const parts = build(chart.guide, cm);
  if (!parts) {
    return {
      grams: null,
      reason: "We can't estimate this shape yet. Weigh one and type it in.",
    };
  }

  const name = material.trim();
  if (!name) {
    return {
      grams: null,
      reason: "Add the material first — the estimate works from how heavy that fabric is.",
    };
  }

  let gsm = guessGsmForMaterial(name, fabricContext(chart.guide));
  if (gsm == null) {
    return {
      grams: null,
      reason: `We don't know how heavy "${name}" is yet. Weigh one and type it in.`,
    };
  }
  if (LIGHT_SHELL_GUIDES.has(chart.guide) && gsm < 250) gsm = Math.min(gsm, LIGHT_SHELL_GSM);
  // A varsity jacket "in wool" is melton, not the suiting or knit that bare
  // "wool" means anywhere else.
  if (chart.guide === "varsity-jacket" && hasWord(name.toLowerCase(), "wool")) {
    gsm = Math.max(gsm, MELTON_GSM);
  }

  const grams =
    parts.main * gsm +
    (parts.lining ?? 0) * LINING_GSM +
    (parts.pocketing ?? 0) * POCKETING_GSM +
    (parts.interlining ?? 0) * INTERLINING_GSM +
    (parts.fill ?? 0) +
    parts.notions;
  return { grams: Math.round(grams / 5) * 5 };
}
