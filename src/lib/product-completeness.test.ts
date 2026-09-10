import { test, expect, describe } from "bun:test";
import { computeIsComplete, missingForCompleteness } from "./product-completeness";

const variant = (over: Partial<Parameters<typeof computeIsComplete>[0]["variants"][0]> = {}) => ({
  price: 5000,
  mainImageUrl: "https://cdn/x.webp",
  weightGrams: 250,
  ...over,
});

const product = (over: Partial<Parameters<typeof computeIsComplete>[0]> = {}) => ({
  title: "Ankara two-piece",
  variants: [variant()],
  ...over,
});

describe("computeIsComplete", () => {
  test("a priced, pictured, weighed product is complete", () => {
    expect(computeIsComplete(product())).toBe(true);
  });

  // The rule this replaced required category_id, and the importer hardcoded
  // that to null -- so nothing could ever be complete and the rest of the
  // check was unreachable. Nothing category-shaped may gate this again.
  test("does not need a category, brand, description, barcode or cost price", () => {
    expect(computeIsComplete(product())).toBe(true);
  });

  test("needs a title", () => {
    expect(computeIsComplete(product({ title: "" }))).toBe(false);
    expect(computeIsComplete(product({ title: "   " }))).toBe(false);
    expect(computeIsComplete(product({ title: null }))).toBe(false);
  });

  test("needs at least one variant, and says only that", () => {
    expect(missingForCompleteness(product({ variants: [] }))).toEqual(["at least one variant"]);
  });

  test("every variant needs a price, a photo and a weight", () => {
    expect(computeIsComplete(product({ variants: [variant({ price: null })] }))).toBe(false);
    expect(computeIsComplete(product({ variants: [variant({ mainImageUrl: null })] }))).toBe(false);
    expect(computeIsComplete(product({ variants: [variant({ weightGrams: null })] }))).toBe(false);
  });

  // A free product is a real thing; a zero price is a blank field that
  // happened to parse. Same for a zero weight -- nothing ships at 0 g.
  test("zero is not a price or a weight", () => {
    expect(computeIsComplete(product({ variants: [variant({ price: 0 })] }))).toBe(false);
    expect(computeIsComplete(product({ variants: [variant({ weightGrams: 0 })] }))).toBe(false);
  });

  test("one bad variant among many blocks the whole product", () => {
    expect(computeIsComplete(product({ variants: [variant(), variant({ price: null })] }))).toBe(
      false,
    );
  });
});

describe("missingForCompleteness", () => {
  test("counts offenders once there is more than one variant", () => {
    const missing = missingForCompleteness(
      product({ variants: [variant({ price: null }), variant({ price: null }), variant()] }),
    );
    expect(missing).toEqual(["a price (2)"]);
  });

  test("drops the count for a single-variant product", () => {
    expect(missingForCompleteness(product({ variants: [variant({ price: null })] }))).toEqual([
      "a price",
    ]);
  });

  test("lists everything missing, title first", () => {
    expect(
      missingForCompleteness({
        title: "",
        variants: [variant({ price: null, mainImageUrl: null, weightGrams: null })],
      }),
    ).toEqual(["a title", "a price", "a photo", "a weight"]);
  });
});
