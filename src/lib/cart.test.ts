import { describe, expect, test } from "bun:test";
import {
  addLine,
  capFor,
  chooseLineVariant,
  groupByStore,
  lineCount,
  lineStatus,
  parseCart,
  reconcileLines,
  removeLines,
  setLineQuantity,
  subtotalOf,
  type CartItem,
  type CartLineInput,
  type FreshProduct,
} from "./cart";
import { MAX_LINE_QTY } from "./order-lines";

function input(over: Partial<CartLineInput> = {}): CartLineInput {
  return {
    productId: "p1",
    variantId: "v1",
    title: "Linen shirt",
    variantLabel: "M",
    imageUrl: null,
    unitPrice: 10000,
    storeId: "s1",
    storeName: "Atelier",
    maxQuantity: null,
    ...over,
  };
}

function bag(...lines: [Partial<CartLineInput>, number][]): CartItem[] {
  let items: CartItem[] = [];
  lines.forEach(([over, q], i) => {
    items = addLine(items, input(over), q, i).items;
  });
  return items;
}

function product(over: Partial<FreshProduct> = {}): FreshProduct {
  return {
    id: "p1",
    title: "Linen shirt",
    storeId: "s1",
    storeName: "Atelier",
    optionName: "Size",
    variants: [
      { id: "v1", label: "M", unitPrice: 10000, imageUrl: null, stock: 5 },
      { id: "v2", label: "L", unitPrice: 10000, imageUrl: null, stock: 0 },
    ],
    ...over,
  };
}

describe("addLine", () => {
  test("a new variant becomes a line of its own, newest first", () => {
    const items = bag([{}, 1], [{ variantId: "v2", variantLabel: "L" }, 2]);
    expect(items.map((i) => [i.variantId, i.quantity])).toEqual([
      ["v2", 2],
      ["v1", 1],
    ]);
  });

  test("the same variant merges into one line", () => {
    const items = bag([{}, 1], [{}, 2]);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  test("quantity is capped by known stock, and the shortfall is reported", () => {
    const first = addLine([], input({ maxQuantity: 2 }), 1, 0);
    expect(first.added).toBe(1);
    const second = addLine(first.items, input({ maxQuantity: 2 }), 5, 1);
    expect(second.added).toBe(1);
    expect(second.items[0].quantity).toBe(2);
    const third = addLine(second.items, input({ maxQuantity: 2 }), 1, 2);
    expect(third.added).toBe(0);
    // Nothing changed, so the same array comes back (no needless re-render).
    expect(third.items).toBe(second.items);
  });

  test("a sold-out variant can't be added", () => {
    const r = addLine([], input({ maxQuantity: 0 }), 1, 0);
    expect(r.added).toBe(0);
    expect(r.items).toHaveLength(0);
  });

  test("without a stock count the order-line ceiling still applies", () => {
    const r = addLine([], input(), 500, 0);
    expect(r.items[0].quantity).toBe(MAX_LINE_QTY);
  });

  test("a picked size stays picked when the same piece comes in from the feed", () => {
    const picked = bag([{}, 1]);
    const again = addLine(picked, input({ needsChoice: true }), 1, 1).items;
    expect(again[0].needsChoice).toBeUndefined();
  });

  test("adding from the product page settles a guessed size", () => {
    const guessed = bag([{ needsChoice: true }, 1]);
    expect(guessed[0].needsChoice).toBe(true);
    const settled = addLine(guessed, input(), 1, 1).items;
    expect(settled[0].needsChoice).toBeUndefined();
  });

  test("the newer snapshot replaces the old title and price, keeping when it was added", () => {
    const items = bag([{}, 1]);
    const next = addLine(items, input({ unitPrice: 12000, title: "Linen shirt II" }), 1, 99).items;
    expect(next[0]).toMatchObject({ unitPrice: 12000, title: "Linen shirt II", addedAt: 0 });
  });
});

describe("setLineQuantity / removeLines", () => {
  test("clamps to the cap", () => {
    const items = bag([{ maxQuantity: 3 }, 1]);
    expect(setLineQuantity(items, "v1", 9)[0].quantity).toBe(3);
  });

  test("below one removes the line", () => {
    expect(setLineQuantity(bag([{}, 2]), "v1", 0)).toHaveLength(0);
  });

  test("an unknown variant is a no-op", () => {
    const items = bag([{}, 2]);
    expect(setLineQuantity(items, "nope", 4)).toBe(items);
  });

  test("removes only the named lines", () => {
    const items = bag([{}, 1], [{ variantId: "v2" }, 1], [{ variantId: "v3" }, 1]);
    expect(removeLines(items, ["v1", "v3"]).map((i) => i.variantId)).toEqual(["v2"]);
    expect(removeLines(items, ["zzz"])).toBe(items);
  });
});

describe("chooseLineVariant", () => {
  const L = {
    variantId: "v2",
    variantLabel: "L",
    unitPrice: 11000,
    imageUrl: null,
    maxQuantity: 4,
  };

  test("switches the line and clears the guess", () => {
    const items = bag([{ needsChoice: true }, 2]);
    const next = chooseLineVariant(items, "v1", L);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ variantId: "v2", variantLabel: "L", unitPrice: 11000 });
    expect(next[0].needsChoice).toBeUndefined();
  });

  test("merges into a line that already holds the chosen variant, within its cap", () => {
    const items = bag([{ variantId: "v2", variantLabel: "L" }, 3], [{}, 2]);
    const next = chooseLineVariant(items, "v1", L);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ variantId: "v2", quantity: 4 });
  });

  test("won't switch to a sold-out variant", () => {
    const items = bag([{}, 1]);
    expect(chooseLineVariant(items, "v1", { ...L, maxQuantity: 0 })).toBe(items);
  });

  test("re-picking the same variant just confirms it", () => {
    const items = bag([{ needsChoice: true }, 1]);
    const next = chooseLineVariant(items, "v1", { ...L, variantId: "v1", variantLabel: "M" });
    expect(next[0]).toMatchObject({ variantId: "v1", quantity: 1 });
    expect(next[0].needsChoice).toBeUndefined();
  });
});

describe("reconcileLines", () => {
  test("a price change updates the line and is reported", () => {
    const items = bag([{}, 1]);
    const fresh = new Map([
      [
        "p1",
        product({
          variants: [{ id: "v1", label: "M", unitPrice: 12500, imageUrl: null, stock: 5 }],
        }),
      ],
    ]);
    const r = reconcileLines(items, fresh, new Set(["p1"]));
    expect(r.items[0].unitPrice).toBe(12500);
    expect(r.notices).toEqual([
      { kind: "price", variantId: "v1", title: "Linen shirt", from: 10000, to: 12500 },
    ]);
  });

  test("a quantity above stock is lowered to what's left", () => {
    const items = bag([{}, 8]);
    const r = reconcileLines(items, new Map([["p1", product()]]), new Set(["p1"]));
    expect(r.items[0].quantity).toBe(5);
    expect(r.items[0].maxQuantity).toBe(5);
    expect(r.notices).toEqual([{ kind: "reduced", variantId: "v1", title: "Linen shirt", to: 5 }]);
  });

  test("sold out is reported and the line kept, so the buyer sees what happened", () => {
    const items = bag([{ variantId: "v2", variantLabel: "L" }, 1]);
    const r = reconcileLines(items, new Map([["p1", product()]]), new Set(["p1"]));
    expect(r.items).toHaveLength(1);
    expect(r.notices[0]).toMatchObject({ kind: "soldout", variantId: "v2" });
  });

  test("a product missing from the answer is gone", () => {
    const items = bag([{}, 1]);
    const r = reconcileLines(items, new Map(), new Set(["p1"]));
    expect(r.items).toBe(items);
    expect(r.notices).toEqual([{ kind: "gone", variantId: "v1", title: "Linen shirt" }]);
  });

  test("a line that wasn't asked about is left alone", () => {
    const items = bag([{}, 1]);
    const r = reconcileLines(items, new Map(), new Set(["other"]));
    expect(r.items).toBe(items);
    expect(r.notices).toEqual([]);
  });

  test("nothing changed returns the same array", () => {
    const items = bag([{ maxQuantity: 5 }, 1]);
    const r = reconcileLines(items, new Map([["p1", product()]]), new Set(["p1"]));
    expect(r.items).toBe(items);
    expect(r.notices).toEqual([]);
  });

  test("the store's current name replaces the stored one", () => {
    const items = bag([{ storeName: "Old name" }, 1]);
    const r = reconcileLines(
      items,
      new Map([["p1", product({ storeName: "New name" })]]),
      new Set(["p1"]),
    );
    expect(r.items[0].storeName).toBe("New name");
    expect(r.notices).toEqual([]);
  });
});

describe("lineStatus", () => {
  const fresh = new Map([["p1", product()]]);
  const asked = new Set(["p1"]);

  test("checking until the lookup covering it answers", () => {
    const [item] = bag([{}, 1]);
    expect(lineStatus(item, null, new Set())).toBe("checking");
    expect(lineStatus(item, fresh, new Set())).toBe("checking");
  });

  test("ok, sold out, gone and unpicked", () => {
    const [ok] = bag([{}, 1]);
    expect(lineStatus(ok, fresh, asked)).toBe("ok");
    const [sold] = bag([{ variantId: "v2" }, 1]);
    expect(lineStatus(sold, fresh, asked)).toBe("soldout");
    const [gone] = bag([{ variantId: "deleted" }, 1]);
    expect(lineStatus(gone, fresh, asked)).toBe("gone");
    const [guess] = bag([{ needsChoice: true }, 1]);
    expect(lineStatus(guess, fresh, asked)).toBe("needsChoice");
  });

  test("an unpriced variant can't be bought", () => {
    const [item] = bag([{}, 1]);
    const unpriced = new Map([
      [
        "p1",
        product({
          variants: [{ id: "v1", label: null, unitPrice: null, imageUrl: null, stock: 3 }],
        }),
      ],
    ]);
    expect(lineStatus(item, unpriced, asked)).toBe("gone");
  });
});

describe("grouping and totals", () => {
  test("groups by store in the order their newest line was added", () => {
    const items = bag(
      [{ storeId: "a", storeName: "A" }, 1],
      [{ variantId: "v2", storeId: "b", storeName: "B" }, 1],
      [{ variantId: "v3", storeId: "a", storeName: "A" }, 1],
    );
    expect(groupByStore(items).map((g) => [g.storeId, g.items.length])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  test("count is units, subtotal is exact to the kobo", () => {
    const items = bag([{ unitPrice: 1999.99 }, 3], [{ variantId: "v2", unitPrice: 0.01 }, 1]);
    expect(lineCount(items)).toBe(4);
    expect(subtotalOf(items)).toBe(5999.98);
  });

  test("subtotal is unknown when any price is", () => {
    expect(subtotalOf(bag([{ unitPrice: null }, 1]))).toBeNull();
  });

  test("capFor", () => {
    expect(capFor(null)).toBe(MAX_LINE_QTY);
    expect(capFor(3)).toBe(3);
    expect(capFor(999)).toBe(MAX_LINE_QTY);
    expect(capFor(-2)).toBe(0);
  });
});

describe("parseCart", () => {
  test("round-trips what the store writes", () => {
    const items = bag([{}, 2], [{ variantId: "v2", needsChoice: true }, 1]);
    expect(parseCart(JSON.stringify({ v: 1, items }))).toEqual(items);
  });

  test("garbage, wrong shapes and missing storage read as an empty bag", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("{not json")).toEqual([]);
    expect(parseCart(JSON.stringify({ items: "nope" }))).toEqual([]);
    expect(parseCart(JSON.stringify([1, 2]))).toEqual([]);
  });

  test("drops bad lines, keeps good ones, and merges duplicates", () => {
    const good = bag([{}, 2])[0];
    const raw = JSON.stringify({
      v: 1,
      items: [
        good,
        { ...good, variantId: "" },
        { ...good, quantity: 0 },
        null,
        { ...good, quantity: 3 },
      ],
    });
    const items = parseCart(raw);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });

  test("an edited quantity can't exceed the ceiling", () => {
    const good = bag([{}, 1])[0];
    const items = parseCart(JSON.stringify({ items: [{ ...good, quantity: 9999 }] }));
    expect(items[0].quantity).toBe(MAX_LINE_QTY);
  });
});
