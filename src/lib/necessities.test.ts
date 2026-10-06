import { test, expect, describe } from "bun:test";
import {
  paramsForCategory,
  paramFillState,
  allNecessitiesFilled,
  carryColorsAcrossKinds,
} from "./necessities";
import type { CategoryNode } from "./categories";
import type { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";

const clothing = [{ id: "clothing", name: "Clothing" }] as CategoryNode[];
const opt = (name: string, ...values: string[]): VariantOption => ({ name, values });

function row(key: string, patch: Partial<VariantRow> = {}): VariantRow {
  return {
    key,
    options: [{ name: "Size", value: key }],
    selected: true,
    price: "",
    compareAtPrice: "",
    costPrice: "",
    sku: "",
    mainImageUrl: "",
    continueSellingOutOfStock: false,
    locationQuantities: {},
    ...patch,
  };
}

// paramFillState takes a long positional argument list; this pins the parts
// each test isn't exercising so the interesting input stays readable.
function fillState(
  param: Parameters<typeof paramFillState>[0],
  over: {
    kind?: "regular" | "variant";
    options?: VariantOption[];
    material?: string;
    rows?: VariantRow[];
    regularWeightGrams?: number | null;
    linkedPostIds?: string[];
  } = {},
) {
  return paramFillState(
    param,
    over.kind ?? "variant",
    over.options ?? [],
    over.material ?? "",
    [],
    {},
    null,
    over.rows ?? [],
    over.regularWeightGrams ?? null,
    over.linkedPostIds ?? [],
  );
}

describe("paramsForCategory", () => {
  // A regular product's colour lives in product_variants.colors, so both
  // kinds are asked for it.
  test("both product kinds are asked for Color", () => {
    expect(paramsForCategory(clothing, "regular")).toContain("Color");
    expect(paramsForCategory(clothing, "variant")).toContain("Color");
  });

  test("an uncategorised product asks for nothing", () => {
    expect(paramsForCategory([], "variant")).toEqual([]);
  });
});

describe("Color", () => {
  test("is filled by a Color axis with values, partial while empty, else empty", () => {
    expect(fillState("Color", { options: [opt("Color", "Black")] })).toBe("filled");
    expect(fillState("Color", { options: [opt("Color")] })).toBe("partial");
    expect(fillState("Color")).toBe("empty");
  });

  test("accepts the seller's own spelling of the axis", () => {
    expect(fillState("Color", { options: [opt("Colour", "Black")] })).toBe("filled");
  });

  test("a regular product is filled by its own colours, not an axis", () => {
    const args = (colors: string[]) =>
      paramFillState("Color", "regular", [], "", [], {}, null, [], null, [], colors);
    expect(args(["Navy"])).toBe("filled");
    expect(args([])).toBe("empty");
  });
});

describe("Material", () => {
  test("a regular product uses its own material field", () => {
    expect(fillState("Material", { kind: "regular", material: "Cotton" })).toBe("filled");
    expect(fillState("Material", { kind: "regular" })).toBe("empty");
  });

  // A variant product never persists the product-level `material` field, so
  // per-row material is the only thing that can satisfy this.
  test("a variant product counts per-row material when there is no Material axis", () => {
    const rows = [row("S", { material: "Cotton" }), row("M", { material: "Cotton" })];
    expect(fillState("Material", { rows })).toBe("filled");
  });

  test("is partial when only some selected rows have a material", () => {
    const rows = [row("S", { material: "Cotton" }), row("M")];
    expect(fillState("Material", { rows })).toBe("partial");
  });

  test("ignores unselected rows", () => {
    const rows = [row("S", { material: "Cotton" }), row("M", { selected: false })];
    expect(fillState("Material", { rows })).toBe("filled");
  });

  test("the product-level material never satisfies a variant product", () => {
    expect(fillState("Material", { material: "Cotton", rows: [row("S")] })).toBe("empty");
  });

  test("a Material axis still wins when there is one", () => {
    expect(fillState("Material", { options: [opt("Material", "Suede")] })).toBe("filled");
  });
});

describe("Weight", () => {
  test("needs every selected variant weighed", () => {
    expect(fillState("Weight", { rows: [row("S", { weightGrams: 250 })] })).toBe("filled");
    expect(fillState("Weight", { rows: [row("S", { weightGrams: 250 }), row("M")] })).toBe(
      "partial",
    );
    expect(fillState("Weight", { rows: [row("S")] })).toBe("empty");
  });

  test("a regular product has exactly one weight, so it is never partial", () => {
    expect(fillState("Weight", { kind: "regular", regularWeightGrams: 250 })).toBe("filled");
    expect(fillState("Weight", { kind: "regular" })).toBe("empty");
  });
});

describe("allNecessitiesFilled", () => {
  // Everything clothing/variant asks for except Link content: a Size axis with
  // a measurement recorded for its one value, a Color axis, a Material axis,
  // and a weighed row.
  function check(
    over: {
      sizeMeasurements?: Record<string, Record<string, number>>;
      linkedPostIds?: string[];
    } = {},
    status: "draft" | "active" = "draft",
  ) {
    return allNecessitiesFilled(
      clothing,
      "variant",
      [opt("Size", "S"), opt("Color", "Black"), opt("Material", "Cotton")],
      "",
      over.sizeMeasurements ?? { S: { chest: 50 } },
      null,
      [row("S", { weightGrams: 250 })],
      null,
      over.linkedPostIds ?? [],
      status,
    );
  }

  test("Link content blocks publishing but not saving a draft", () => {
    expect(check()).toBe(true);
    expect(check({}, "active")).toBe(false);
    expect(check({ linkedPostIds: ["post-1"] }, "active")).toBe(true);
  });

  test("an unmeasured size blocks even a draft", () => {
    expect(check({ sizeMeasurements: {} })).toBe(false);
  });

  test("an uncategorised product blocks nothing", () => {
    expect(allNecessitiesFilled([], "variant", [], "", {}, null, [], null, [], "active")).toBe(
      true,
    );
  });
});

describe("carryColorsAcrossKinds", () => {
  test("regular to variant: the colours become a Color option", () => {
    const out = carryColorsAcrossKinds("variant", [], ["Navy"]);
    expect(out.options).toEqual([{ name: "Color", values: ["Navy"] }]);
  });

  test("variant to regular: the Color option's values become the colours", () => {
    const out = carryColorsAcrossKinds("regular", [{ name: "Colour", values: ["Red"] }], []);
    expect(out.regularColors).toEqual(["Red"]);
  });

  test("never overwrites a colour the other kind already has", () => {
    const axis = [{ name: "Color", values: ["Red"] }];
    expect(carryColorsAcrossKinds("variant", axis, ["Navy"]).options).toBe(axis);
    expect(carryColorsAcrossKinds("regular", axis, ["Navy"]).regularColors).toEqual(["Navy"]);
  });
});
