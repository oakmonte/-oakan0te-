import { test, expect, describe } from "bun:test";
import {
  parseWeightVolumeValueToGrams,
  estimateWeight,
  guessGsmForMaterial,
} from "./weight-estimate";
import { MATERIAL_GROUPS } from "./material-options";
import { ALL_SIZE_CHARTS } from "./size-chart-config";
import type { SizeChartDefinition } from "./size-chart-config";

const TEE: SizeChartDefinition = {
  id: "standard-tshirt",
  guide: "standard-tshirt",
  lines: [
    { key: "shoulder_width", label: "a" },
    { key: "chest_width", label: "b" },
    { key: "body_length", label: "c" },
    { key: "sleeve_length", label: "d" },
  ],
};
const TEE_CM = { chest_width: 52, body_length: 70, sleeve_length: 20 };

// Every branch here produces a string a seller reads and acts on, so each
// one is pinned to the situation that should produce it -- a wrong branch
// means telling someone to go fix the wrong thing.
describe("guessGsmForMaterial", () => {
  // The picker's spellings and the GSM keywords are matched by substring, so
  // an accent or a rename breaks the link with no error anywhere -- "Piqué"
  // contains no "pique". Every fabric a seller can tap must resolve.
  test("every fabric in the picker is recognised", () => {
    const fabrics = MATERIAL_GROUPS.find((g) => g.label === "Fabrics")!.materials;
    const unrecognised = fabrics.filter((m) => guessGsmForMaterial(m) === null);
    expect(unrecognised).toEqual([]);
  });

  // Coated synthetics contain "leather", so they must resolve before the
  // hides -- and hides are estimated from their usual thickness.
  test("imitation leather is lighter than hide, and hides go by thickness", () => {
    expect(guessGsmForMaterial("Faux leather")).toBe(550);
    expect(guessGsmForMaterial("PU leather")).toBe(550);
    expect(guessGsmForMaterial("Lambskin")).toBeLessThan(guessGsmForMaterial("Cowhide")!);
    expect(guessGsmForMaterial("Leather")).toBe(900);
    expect(guessGsmForMaterial("Faux suede")).toBeLessThan(guessGsmForMaterial("Suede")!);
  });

  test("matches whole words, not letters inside another word", () => {
    expect(guessGsmForMaterial("lace")).toBe(120);
    expect(guessGsmForMaterial("necklace chain")).toBeNull();
    expect(guessGsmForMaterial("Laces")).toBe(120);
  });

  // "Cotton" on a tee is jersey, on chinos twill, on a hoodie fleece.
  test("a bare fibre takes the weight its garment usually is", () => {
    expect(guessGsmForMaterial("Cotton", "top")).toBeLessThan(
      guessGsmForMaterial("Cotton", "bottom")!,
    );
    expect(guessGsmForMaterial("Cotton", "bottom")).toBeLessThan(
      guessGsmForMaterial("Cotton", "fleece")!,
    );
    // A named fabric ignores the garment.
    expect(guessGsmForMaterial("Poplin", "fleece")).toBe(guessGsmForMaterial("Poplin", "top"));
  });

  test("a blend takes its first-named fibre", () => {
    expect(guessGsmForMaterial("80% cotton 20% polyester", "top")).toBe(
      guessGsmForMaterial("cotton", "top"),
    );
    expect(guessGsmForMaterial("poly/cotton", "top")).toBe(guessGsmForMaterial("polyester", "top"));
  });

  test("a compound name resolves to the specific fabric, not the bare fibre", () => {
    expect(guessGsmForMaterial("silk chiffon")).toBe(60);
    expect(guessGsmForMaterial("polyester satin")).toBe(90);
    expect(guessGsmForMaterial("silk")).toBe(100);
  });

  // Printed/dyed cotton gets cotton's weight; handwoven and beaded cloth is
  // deliberately absent rather than given an invented midpoint.
  test("West African fabrics: printed cotton yes, handwoven no", () => {
    expect(guessGsmForMaterial("Ankara")).toBe(200);
    expect(guessGsmForMaterial("Adire")).toBe(200);
    expect(guessGsmForMaterial("Aso oke")).toBeNull();
    expect(guessGsmForMaterial("George")).toBeNull();
  });
});

describe("estimateWeight", () => {
  test("estimates a plain t-shirt", () => {
    const result = estimateWeight(TEE, TEE_CM, "cotton jersey");
    expect(result.grams).toBeGreaterThan(100);
    expect(result.grams).toBeLessThan(400);
  });

  // standard-tshirt is what the "T-Shirts" category actually maps to. It had
  // no area formula, so the most common product in the catalogue could never
  // be estimated -- and the UI showed nothing at all rather than saying why.
  test("covers the chart ids that are the same shape under another name", () => {
    for (const guide of ["tshirt", "standard-tshirt", "activewear-tshirt"] as const) {
      expect(estimateWeight({ ...TEE, guide }, TEE_CM, "cotton").grams).not.toBeNull();
    }
    expect(estimateWeight({ ...TEE, guide: "polo-alt" }, TEE_CM, "cotton pique").grams).toBe(
      estimateWeight({ ...TEE, guide: "polo" }, TEE_CM, "cotton pique").grams,
    );
  });

  test("names the missing measurement, by letter and by name", () => {
    const result = estimateWeight(TEE, { chest_width: 52 }, "cotton");
    expect(result.grams).toBeNull();
    expect(result).toHaveProperty("reason", expect.stringContaining("c (body length)"));
  });

  test("asks for the material when there isn't one", () => {
    const result = estimateWeight(TEE, TEE_CM, "  ");
    expect(result.grams).toBeNull();
    expect(result).toHaveProperty("reason", expect.stringContaining("material"));
  });

  test("names an unrecognised material back to the seller", () => {
    const unknown = estimateWeight(TEE, TEE_CM, "Vibranium");
    expect(unknown.grams).toBeNull();
    expect(unknown).toHaveProperty("reason", expect.stringContaining("Vibranium"));
  });

  test("says so with no chart at all", () => {
    expect(estimateWeight(null, {}, "cotton").grams).toBeNull();
  });

  // Some sellers type the full tape measurement instead of the flat width.
  test("treats an impossible flat width as a circumference", () => {
    expect(estimateWeight(TEE, { ...TEE_CM, chest_width: 104 }, "cotton").grams).toBe(
      estimateWeight(TEE, TEE_CM, "cotton").grams,
    );
  });

  test("never returns a reason alongside a number", () => {
    expect(estimateWeight(TEE, TEE_CM, "cotton")).not.toHaveProperty("reason");
  });
});

describe("parseWeightVolumeValueToGrams", () => {
  test("reads a plain gram value", () => {
    expect(parseWeightVolumeValueToGrams("250 g")).toBe(250);
  });

  // The bug this test exists for: rounding to the nearest whole gram turned
  // every sub-gram value into 0, so a real product reported as weighing
  // nothing. Anything under 0.5 g is the regression case.
  test("keeps a sub-gram weight instead of rounding it to nothing", () => {
    expect(parseWeightVolumeValueToGrams("0.2 g")).toBe(0.2);
    expect(parseWeightVolumeValueToGrams("0.05 g")).toBe(0.05);
  });

  test("converts the other weight units", () => {
    expect(parseWeightVolumeValueToGrams("1 kg")).toBe(1000);
    expect(parseWeightVolumeValueToGrams("1 oz")).toBe(28.35);
    expect(parseWeightVolumeValueToGrams("2 lb")).toBe(907.18);
  });

  test("tolerates casing and missing spaces", () => {
    expect(parseWeightVolumeValueToGrams("500G")).toBe(500);
    expect(parseWeightVolumeValueToGrams(" 2  KG ")).toBe(2000);
  });

  // Volume is a real Weight/Volume option unit, but litres aren't grams --
  // guessing a density here would be inventing a shipping weight.
  test("returns null for volumes and anything unparseable", () => {
    expect(parseWeightVolumeValueToGrams("500 ml")).toBeNull();
    expect(parseWeightVolumeValueToGrams("1 L")).toBeNull();
    expect(parseWeightVolumeValueToGrams("Large")).toBeNull();
    expect(parseWeightVolumeValueToGrams("")).toBeNull();
    expect(parseWeightVolumeValueToGrams("0 g")).toBeNull();
  });
});

// Guides that intentionally have no area formula, with the reason. Anything
// else missing one is a gap, not a decision.
const NO_FORMULA_BY_DESIGN: Record<string, string> = {};

describe("every size chart can be estimated", () => {
  // The 2026-09-10 artwork batch added 19 guides with images but no area
  // formula, so roughly half the catalogue -- hoodies,
  // tank tops, cargo pants, skirts -- silently answered "we can't estimate
  // this shape". Nothing failed; sellers just got no button. This is the
  // guard so the next batch can't repeat it.
  test("every guide has a formula, or a documented reason not to", () => {
    const unsupported: string[] = [];

    for (const chart of ALL_SIZE_CHARTS) {
      if (NO_FORMULA_BY_DESIGN[chart.guide]) continue;
      // Feed every measurement its own chart offers, so the only way to fail
      // is a genuinely missing formula rather than a missing input.
      const cm = Object.fromEntries(chart.lines.map((l) => [l.key, 50]));
      const result = estimateWeight(chart, cm, "cotton");
      if (result.grams == null) unsupported.push(`${chart.guide}: ${result.reason}`);
    }

    expect(unsupported).toEqual([]);
  });

  test("a supported shape returns a plausible garment weight", () => {
    for (const chart of ALL_SIZE_CHARTS) {
      if (NO_FORMULA_BY_DESIGN[chart.guide]) continue;
      const cm = Object.fromEntries(chart.lines.map((l) => [l.key, 50]));
      const grams = estimateWeight(chart, cm, "cotton").grams;
      expect(grams).toBeGreaterThan(20);
      expect(grams).toBeLessThan(5000);
    }
  });
});

// Real garments, weighed. Each range is what that garment actually weighs in
// that size and fabric across common brands; the estimate must land inside
// it. If you change a ratio, GSM or notions figure in weight-estimate.ts,
// this is what tells you whether it got more or less right.
const REFERENCE: [string, string, Record<string, number>, string, number, number][] = [
  // guide, material, flat cm, label, min g, max g
  [
    "standard-tshirt",
    "Cotton",
    { chest_width: 51, body_length: 74, sleeve_length: 20 },
    "tee M",
    150,
    200,
  ],
  ["polo", "Pique", { chest_width: 53, body_length: 72, sleeve_length: 22 }, "polo M", 200, 260],
  [
    "dress-shirt",
    "Poplin",
    { chest_width: 56, body_length: 78, sleeve_length: 64 },
    "poplin shirt M",
    180,
    260,
  ],
  [
    "hoodie",
    "Cotton",
    { chest_width: 56, body_length: 71, sleeve_length: 62 },
    "pullover hoodie M",
    450,
    650,
  ],
  [
    "sweatshirt",
    "Cotton fleece",
    { chest_width: 56, body_length: 70, sleeve_length: 62 },
    "crewneck M",
    380,
    520,
  ],
  [
    "baggy-jeans",
    "Denim",
    { waist_width: 41, outseam_length: 106, leg_opening: 20 },
    "jeans W32",
    520,
    750,
  ],
  [
    "baggy-corporate-trousers",
    "Cotton",
    { waist_width: 41, outseam_length: 104 },
    "chinos W32",
    350,
    500,
  ],
  [
    "cuffed-joggers",
    "Cotton",
    { waist_width: 36, outseam_length: 100, leg_opening: 12 },
    "fleece joggers M",
    330,
    480,
  ],
  [
    "leggings",
    "Nylon spandex",
    { waist_width: 33, hip_width: 42, inseam_length: 70, leg_opening: 9 },
    "leggings M",
    160,
    260,
  ],
  [
    "denim-jorts",
    "Denim",
    { waist_width: 41, outseam_length: 55, leg_opening: 30 },
    "jorts W32",
    300,
    450,
  ],
  [
    "puffer-jacket",
    "Nylon",
    { chest_width: 60, body_length: 70, sleeve_length: 64 },
    "puffer M",
    500,
    1000,
  ],
  [
    "leather-jacket",
    "Leather",
    { chest_width: 55, body_length: 66, sleeve_length: 64 },
    "leather jacket M",
    1100,
    2200,
  ],
  [
    "trucker-jacket",
    "Denim",
    { chest_width: 56, body_length: 66, sleeve_length: 63 },
    "trucker jacket M",
    520,
    800,
  ],
  [
    "varsity-jacket",
    "Wool",
    { chest_width: 60, body_length: 68, sleeve_length: 64 },
    "varsity jacket M",
    850,
    1500,
  ],
  ["tank-top", "Cotton", { chest_width: 50, body_length: 70 }, "tank M", 90, 150],
  ["sports-bra", "Nylon spandex", { chest_width: 34, body_length: 25 }, "sports bra M", 50, 110],
  [
    "a-line-dress",
    "Linen",
    { chest_width: 46, body_length: 105, hem_width: 75 },
    "linen midi dress",
    170,
    320,
  ],
];

describe("reference garments", () => {
  for (const [guide, material, cm, label, min, max] of REFERENCE) {
    test(`${label} in ${material.toLowerCase()} weighs ${min}-${max} g`, () => {
      const chart = { id: guide, guide: guide as SizeChartDefinition["guide"], lines: [] };
      const grams = estimateWeight(chart, cm, material).grams;
      expect(grams).toBeGreaterThanOrEqual(min);
      expect(grams).toBeLessThanOrEqual(max);
    });
  }
});
