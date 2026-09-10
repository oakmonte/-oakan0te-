import { test, expect, describe } from "bun:test";
import { parseWeightVolumeValueToGrams, estimateWeight } from "./weight-estimate";
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
const CORSET: SizeChartDefinition = {
  id: "clothing-corset",
  guide: "clothing-corset",
  lines: [{ key: "bust_width", label: "a" }],
};
const TEE_CM = { chest_width: 52, body_length: 70, sleeve_length: 20 };

// Every branch here produces a string a seller reads and acts on, so each
// one is pinned to the situation that should produce it -- a wrong branch
// means telling someone to go fix the wrong thing.
describe("estimateWeight", () => {
  test("estimates a plain t-shirt", () => {
    const result = estimateWeight(TEE, TEE_CM, "cotton jersey");
    // ~0.85 m² of 180 gsm jersey plus 6.5% trim, rounded to 5 g.
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

  // Distinct from an unrecognised fabric: suede/leather will never be
  // estimable, so the copy must not imply we'll learn it later.
  test("explains that hide is not fabric, separately from an unknown fabric", () => {
    const hide = estimateWeight(TEE, TEE_CM, "Suede");
    expect(hide.grams).toBeNull();
    expect(hide).toHaveProperty("reason", expect.stringContaining("hide"));

    const unknown = estimateWeight(TEE, TEE_CM, "Vibranium");
    expect(unknown.grams).toBeNull();
    expect(unknown).toHaveProperty("reason", expect.stringContaining("Vibranium"));
  });

  test("says so for a shape with no formula, and for no chart at all", () => {
    expect(estimateWeight(CORSET, { bust_width: 40 }, "cotton").grams).toBeNull();
    expect(estimateWeight(null, {}, "cotton").grams).toBeNull();
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
