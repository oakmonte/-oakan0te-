import { test, expect, describe } from "bun:test";
import { buildKey, cartesian, regenerateRows, weightVolumeValueOf } from "./variant-combinations";
import type { VariantOption, VariantRow } from "./VariantMatrixBuilder";

const opt = (name: string, ...values: string[]): VariantOption => ({ name, values });

function row(key: string, values: string[], patch: Partial<VariantRow> = {}): VariantRow {
  return {
    key,
    options: values.map((v) => ({ name: "Size", value: v })),
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

describe("cartesian", () => {
  test("skips options with no name or no values", () => {
    expect(cartesian([opt("Size"), opt("", "x")])).toEqual([]);
  });

  test("produces the N-way product", () => {
    const combos = cartesian([opt("Size", "S", "M"), opt("Color", "Black", "Onyx")]);
    expect(combos.map(buildKey)).toEqual(["S|Black", "S|Onyx", "M|Black", "M|Onyx"]);
  });
});

describe("weightVolumeValueOf", () => {
  test("finds the axis regardless of casing/spacing", () => {
    expect(weightVolumeValueOf([{ name: " Weight/Volume ", value: "250 g" }])).toBe("250 g");
  });

  test("is null when no such axis is present", () => {
    expect(weightVolumeValueOf([{ name: "Size", value: "S" }])).toBeNull();
  });
});

describe("regenerateRows", () => {
  test("creates blank rows for brand new combinations", () => {
    const rows = regenerateRows([opt("Size", "S")], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "S", price: "", selected: true });
  });

  test("keeps a row's entered data when its key is unchanged", () => {
    const prev = [row("S", ["S"], { price: "20000", sku: "AB-1" })];
    const [next] = regenerateRows([opt("Size", "S", "M")], prev);
    expect(next).toMatchObject({ key: "S", price: "20000", sku: "AB-1" });
  });

  test("keeps an unchecked row unchecked", () => {
    const prev = [row("S", ["S"], { selected: false })];
    expect(regenerateRows([opt("Size", "S")], prev)[0].selected).toBe(false);
  });

  // The regression this function exists to prevent: adding an axis rekeys
  // every row, and a plain key lookup misses all of them.
  test("carries entered data forward when a new axis is added", () => {
    const prev = [
      row("S", ["S"], { price: "20000", locationQuantities: { loc1: 5 } }),
      row("M", ["M"], { price: "30000" }),
    ];
    const rows = regenerateRows([opt("Size", "S", "M"), opt("Color", "Black", "Onyx")], prev);

    expect(rows.map((r) => r.key)).toEqual(["S|Black", "S|Onyx", "M|Black", "M|Onyx"]);
    // Both rows the old "S" split into inherit its price and stock.
    expect(rows[0]).toMatchObject({ price: "20000", locationQuantities: { loc1: 5 } });
    expect(rows[1]).toMatchObject({ price: "20000", locationQuantities: { loc1: 5 } });
    expect(rows[2].price).toBe("30000");
    expect(rows[3].price).toBe("30000");
  });

  test("does not carry data across a renamed value", () => {
    const prev = [row("Small", ["Small"], { price: "20000" })];
    expect(regenerateRows([opt("Size", "Extra Small")], prev)[0].price).toBe("");
  });

  test("drops rows whose combination no longer exists", () => {
    const prev = [row("S", ["S"], { price: "20000" }), row("M", ["M"], { price: "30000" })];
    const rows = regenerateRows([opt("Size", "S")], prev);
    expect(rows.map((r) => r.key)).toEqual(["S"]);
  });
});

describe("regenerateRows + Weight/Volume", () => {
  test("pre-fills weight from a Weight/Volume value on a new row", () => {
    const rows = regenerateRows([opt("Weight/Volume", "250 g")], []);
    expect(rows[0].weightGrams).toBe(250);
  });

  test("pre-fills weight on a row that inherited from an older axis", () => {
    const prev = [row("S", ["S"], { price: "20000" })];
    const rows = regenerateRows([opt("Size", "S"), opt("Weight/Volume", "250 g")], prev);
    expect(rows[0]).toMatchObject({ key: "S|250 g", price: "20000", weightGrams: 250 });
  });

  test("a hand-typed weight is never overwritten by the axis", () => {
    const prev = [row("S", ["S"], { weightGrams: 999 })];
    const rows = regenerateRows([opt("Size", "S"), opt("Weight/Volume", "250 g")], prev);
    expect(rows[0].weightGrams).toBe(999);
  });
});
