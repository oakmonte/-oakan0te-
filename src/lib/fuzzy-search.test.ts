import { test, expect, describe } from "bun:test";
import { normalizeForSearch, fuzzyScore, fuzzyFilter } from "./fuzzy-search";
import { MATERIAL_PRESETS } from "./material-options";

const matches = (q: string, c: string) => fuzzyScore(q, c) !== null;

describe("normalizeForSearch", () => {
  test("strips accents, case and punctuation", () => {
    expect(normalizeForSearch("Piqué")).toBe("pique");
    expect(normalizeForSearch("  Gold-plated! ")).toBe("gold plated");
  });
});

describe("fuzzyScore", () => {
  // The whole point: these are the spellings a seller actually types.
  test("forgives a one-letter slip", () => {
    expect(matches("cotten", "Cotton")).toBe(true);
    expect(matches("chifon", "Chiffon")).toBe(true);
    expect(matches("polyster", "Polyester")).toBe(true);
    expect(matches("corderoy", "Corduroy")).toBe(true);
    expect(matches("ankra", "Ankara")).toBe(true);
    expect(matches("sterlin silver", "Sterling silver")).toBe(true);
  });

  test("matches an accented query against an unaccented preset", () => {
    expect(fuzzyScore("Piqué", "Pique")).toBe(0);
  });

  // A short query has no typo budget on purpose: at three letters a single
  // edit reaches a large share of any list, and the noise buries the exact
  // answer the seller meant.
  test("does not invent matches for short queries", () => {
    expect(matches("red", "Bed")).toBe(false);
    expect(matches("zzz", "Cotton")).toBe(false);
    expect(matches("gold", "Cork")).toBe(false);
  });

  test("exact and prefix always outrank a typo correction", () => {
    const exact = fuzzyScore("cotton", "Cotton")!;
    const prefix = fuzzyScore("cotton", "Cotton blend")!;
    const typo = fuzzyScore("cotten", "Cotton")!;
    expect(exact).toBeLessThan(prefix);
    expect(prefix).toBeLessThan(typo);
  });

  test("an empty query matches everything", () => {
    expect(fuzzyScore("", "Cotton")).toBe(0);
  });
});

describe("fuzzyFilter", () => {
  test("ranks the intended preset first", () => {
    const first = (q: string) => fuzzyFilter(q, MATERIAL_PRESETS, (m) => m)[0];
    expect(first("cotton")).toBe("Cotton");
    expect(first("cotten")).toBe("Cotton");
    expect(first("ankara")).toBe("Ankara");
    expect(first("sterling")).toBe("Sterling silver");
    expect(first("velvet")).toBe("Velvet");
  });

  test("keeps curated order among equally-good matches", () => {
    expect(fuzzyFilter("", ["b", "a", "c"], (s) => s)).toEqual(["b", "a", "c"]);
    // Both are plain substring hits, so the list's own order decides.
    expect(fuzzyFilter("leather", MATERIAL_PRESETS, (m) => m).slice(0, 2)).toEqual([
      "Leather",
      "Faux leather",
    ]);
  });

  test("returns nothing for a query that matches nothing", () => {
    expect(fuzzyFilter("vibranium", MATERIAL_PRESETS, (m) => m)).toEqual([]);
  });
});
