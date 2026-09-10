import { test, expect, describe } from "bun:test";
import { parseWeightVolumeValueToGrams } from "./weight-estimate";

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
