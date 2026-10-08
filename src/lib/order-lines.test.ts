import { describe, expect, test } from "bun:test";
import {
  MAX_LINE_QTY,
  MAX_ORDER_LINES,
  itemsTotalKobo,
  packageItems,
  parseOrderLines,
  priceLines,
  stockCeiling,
  stockProblem,
  variantLabelOf,
  type ProductRow,
  type VariantRow,
} from "./order-lines";

function variant(over: Partial<VariantRow> = {}): VariantRow {
  return {
    id: "v1",
    price: 10000,
    weight_grams: 400,
    option1_value: "M",
    option2_value: null,
    option3_value: null,
    main_image_url: "https://img/v1.jpg",
    stock_qty: 5,
    continue_selling_out_of_stock: false,
    ...over,
  };
}

function productRow(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "p1",
    title: "Linen shirt",
    store_id: "s1",
    product_variants: [variant(), variant({ id: "v2", option1_value: "L", stock_qty: 0 })],
    ...over,
  };
}

describe("parseOrderLines", () => {
  test("the Buy Now shape is one line of one, variant optional", () => {
    expect(parseOrderLines({ productId: "p1", variantId: "v1" })).toEqual({
      ok: true,
      legacy: true,
      lines: [{ productId: "p1", variantId: "v1", quantity: 1 }],
    });
    expect(parseOrderLines({ productId: "p1" })).toEqual({
      ok: true,
      legacy: true,
      lines: [{ productId: "p1", variantId: null, quantity: 1 }],
    });
  });

  test("the Buy Now shape still needs a product", () => {
    expect(parseOrderLines({}).ok).toBe(false);
  });

  test("bag lines merge per variant", () => {
    const r = parseOrderLines({
      items: [
        { productId: "p1", variantId: "v1", quantity: 2 },
        { productId: "p2", variantId: "v9", quantity: 1 },
        { productId: "p1", variantId: "v1", quantity: 3 },
      ],
    });
    expect(r).toEqual({
      ok: true,
      legacy: false,
      lines: [
        { productId: "p1", variantId: "v1", quantity: 5 },
        { productId: "p2", variantId: "v9", quantity: 1 },
      ],
    });
  });

  test("bag lines must name their variant", () => {
    expect(parseOrderLines({ items: [{ productId: "p1", quantity: 1 }] }).ok).toBe(false);
  });

  test("quantities must be whole, positive and within the line ceiling", () => {
    for (const quantity of [0, -1, 1.5, "2", null, MAX_LINE_QTY + 1]) {
      expect(parseOrderLines({ items: [{ productId: "p1", variantId: "v1", quantity }] }).ok).toBe(
        false,
      );
    }
    // Two halves that only exceed it together are caught after merging.
    const split = Math.ceil(MAX_LINE_QTY / 2) + 1;
    expect(
      parseOrderLines({
        items: [
          { productId: "p1", variantId: "v1", quantity: split },
          { productId: "p1", variantId: "v1", quantity: split },
        ],
      }).ok,
    ).toBe(false);
  });

  test("an empty or oversized bag is refused", () => {
    expect(parseOrderLines({ items: [] }).ok).toBe(false);
    expect(parseOrderLines({ items: "p1" }).ok).toBe(false);
    const many = Array.from({ length: MAX_ORDER_LINES + 1 }, (_, i) => ({
      productId: "p",
      variantId: `v${i}`,
      quantity: 1,
    }));
    expect(parseOrderLines({ items: many }).ok).toBe(false);
  });

  test("one variant can't be claimed by two products", () => {
    const r = parseOrderLines({
      items: [
        { productId: "p1", variantId: "v1", quantity: 1 },
        { productId: "p2", variantId: "v1", quantity: 1 },
      ],
    });
    expect(r.ok).toBe(false);
  });

  test("money in the body is ignored, not trusted", () => {
    const r = parseOrderLines({
      items: [{ productId: "p1", variantId: "v1", quantity: 1, unitPrice: 1 }],
      total: 1,
    });
    expect(r).toEqual({
      ok: true,
      legacy: false,
      lines: [{ productId: "p1", variantId: "v1", quantity: 1 }],
    });
  });
});

describe("variantLabelOf / stockCeiling", () => {
  test("labels only tell siblings apart", () => {
    expect(variantLabelOf({ option1_value: "M" }, 1)).toBeNull();
    expect(variantLabelOf({ option1_value: "M" }, 2)).toBe("M");
    expect(
      variantLabelOf({ option1_value: "Red", option2_value: " M ", option3_value: "" }, 4),
    ).toBe("Red / M");
    expect(variantLabelOf({ option1_value: null }, 3)).toBeNull();
  });

  test("selling past zero has no ceiling; no stock count with no oversell is none", () => {
    expect(stockCeiling({ stock_qty: 0, continue_selling_out_of_stock: true })).toBeNull();
    expect(stockCeiling({ stock_qty: null, continue_selling_out_of_stock: false })).toBe(0);
    expect(stockCeiling({ stock_qty: -3, continue_selling_out_of_stock: false })).toBe(0);
    expect(stockCeiling({ stock_qty: 7, continue_selling_out_of_stock: false })).toBe(7);
  });
});

describe("priceLines", () => {
  test("prices every line from the rows, not the request", () => {
    const r = priceLines(
      [
        { productId: "p1", variantId: "v1", quantity: 2 },
        { productId: "p2", variantId: "w1", quantity: 1 },
      ],
      [
        productRow(),
        productRow({
          id: "p2",
          title: "Wrap skirt",
          product_variants: [variant({ id: "w1", price: 15500.5, weight_grams: null })],
        }),
      ],
      false,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.storeId).toBe("s1");
    expect(r.items).toEqual([
      {
        productId: "p1",
        variantId: "v1",
        storeId: "s1",
        title: "Linen shirt",
        variantLabel: "M",
        imageUrl: "https://img/v1.jpg",
        unitPrice: 10000,
        quantity: 2,
        weightGrams: 400,
        stock: 5,
      },
      {
        productId: "p2",
        variantId: "w1",
        storeId: "s1",
        title: "Wrap skirt",
        variantLabel: null,
        imageUrl: "https://img/v1.jpg",
        unitPrice: 15500.5,
        quantity: 1,
        weightGrams: null,
        stock: 5,
      },
    ]);
    expect(itemsTotalKobo(r.items)).toBe(2 * 1_000_000 + 1_550_050);
  });

  test("Buy Now falls back to the first variant, as it always has", () => {
    const r = priceLines([{ productId: "p1", variantId: null, quantity: 1 }], [productRow()], true);
    expect(r.ok && r.items[0].variantId).toBe("v1");
    const stale = priceLines(
      [{ productId: "p1", variantId: "old", quantity: 1 }],
      [productRow()],
      true,
    );
    expect(stale.ok && stale.items[0].variantId).toBe("v1");
  });

  test("the bag never swaps an unknown variant for another", () => {
    const r = priceLines(
      [{ productId: "p1", variantId: "old", quantity: 1 }],
      [productRow()],
      false,
    );
    expect(r).toMatchObject({ ok: false, status: 409 });
  });

  test("an inactive or missing product is unavailable", () => {
    expect(priceLines([{ productId: "gone", variantId: null, quantity: 1 }], [], true)).toEqual({
      ok: false,
      error: "This product isn't available.",
      status: 404,
    });
    expect(
      priceLines([{ productId: "gone", variantId: "v1", quantity: 1 }], [], false),
    ).toMatchObject({ ok: false, status: 409 });
  });

  test("an unpriced variant can't be sold", () => {
    const rows = [productRow({ product_variants: [variant({ price: null })] })];
    expect(priceLines([{ productId: "p1", variantId: "v1", quantity: 1 }], rows, true)).toEqual({
      ok: false,
      error: "This product has no price.",
      status: 422,
    });
    expect(
      priceLines([{ productId: "p1", variantId: "v1", quantity: 1 }], rows, false),
    ).toMatchObject({ ok: false, status: 422 });
  });

  test("a bag that spans stores is refused", () => {
    const r = priceLines(
      [
        { productId: "p1", variantId: "v1", quantity: 1 },
        { productId: "p2", variantId: "w1", quantity: 1 },
      ],
      [
        productRow(),
        productRow({ id: "p2", store_id: "s2", product_variants: [variant({ id: "w1" })] }),
      ],
      false,
    );
    expect(r).toMatchObject({ ok: false, status: 422 });
  });
});

describe("stockProblem", () => {
  const line = (stock: number | null, quantity: number) => ({
    productId: "p1",
    variantId: "v1",
    storeId: "s1",
    title: "Linen shirt",
    variantLabel: null,
    imageUrl: null,
    unitPrice: 10000,
    quantity,
    weightGrams: null,
    stock,
  });

  test("enough stock, or no ceiling, is fine", () => {
    expect(stockProblem([line(3, 3), line(null, 20)], false)).toBeNull();
  });

  test("Buy Now keeps its original message", () => {
    expect(stockProblem([line(0, 1)], true)).toBe("Sorry, that item just sold out.");
  });

  test("the bag names the piece and how many are left", () => {
    expect(stockProblem([line(0, 1)], false)).toBe("Sorry, Linen shirt just sold out.");
    expect(stockProblem([line(2, 3)], false)).toContain("Only 2 left of Linen shirt");
  });
});

describe("packageItems", () => {
  test("one entry per line with per-unit weight and the count", () => {
    const r = priceLines(
      [{ productId: "p1", variantId: "v1", quantity: 3 }],
      [productRow()],
      false,
    );
    if (!r.ok) throw new Error("expected priced lines");
    expect(packageItems(r.items, 0.5)).toEqual([
      {
        name: "Linen shirt",
        description: "Linen shirt",
        unit_weight: "0.4",
        unit_amount: "10000",
        quantity: "3",
      },
    ]);
  });

  test("an unweighed variant uses the default weight", () => {
    const rows = [productRow({ product_variants: [variant({ weight_grams: null })] })];
    const r = priceLines([{ productId: "p1", variantId: null, quantity: 1 }], rows, true);
    if (!r.ok) throw new Error("expected priced lines");
    expect(packageItems(r.items, 0.5)[0].unit_weight).toBe("0.5");
  });
});
