import { describe, expect, test } from "bun:test";
import {
  planRegularVariantId,
  planVariantIds,
  type ExistingOption,
  type ExistingVariant,
} from "./product-variant-ids";

function ids() {
  let n = 0;
  return () => `new-${++n}`;
}

// Size [S, M] x Colour [Red, Blue], all four combinations stocked.
const options: ExistingOption[] = [
  {
    id: "opt-size",
    name: "Size",
    position: 0,
    values: [
      { id: "val-s", value: "S" },
      { id: "val-m", value: "M" },
    ],
  },
  {
    id: "opt-colour",
    name: "Colour",
    position: 1,
    values: [
      { id: "val-red", value: "Red" },
      { id: "val-blue", value: "Blue" },
    ],
  },
];

function variant(
  id: string,
  size: string,
  colour: string,
  createdAt = "2026-11-01",
): ExistingVariant {
  const sizeOpt = options[0].values.find((v) => v.value === size)!;
  const colourOpt = options[1].values.find((v) => v.value === colour)!;
  return {
    id,
    createdAt,
    links: [
      { optionId: "opt-size", valueId: sizeOpt.id },
      { optionId: "opt-colour", valueId: colourOpt.id },
    ],
    flat: [
      { name: "Size", value: size },
      { name: "Colour", value: colour },
    ],
  };
}

const variants = [
  variant("var-s-red", "S", "Red"),
  variant("var-s-blue", "S", "Blue"),
  variant("var-m-red", "M", "Red"),
  variant("var-m-blue", "M", "Blue"),
];

const row = (size: string, colour: string, colourName = "Colour") => ({
  options: [
    { name: "Size", value: size },
    { name: colourName, value: colour },
  ],
});

describe("planVariantIds", () => {
  test("an unchanged product keeps every id", () => {
    const plan = planVariantIds(
      options,
      variants,
      [
        { name: "Size", values: ["S", "M"] },
        { name: "Colour", values: ["Red", "Blue"] },
      ],
      [row("S", "Red"), row("S", "Blue"), row("M", "Red"), row("M", "Blue")],
      ids(),
    );
    expect(plan.options.map((o) => o.id)).toEqual(["opt-size", "opt-colour"]);
    expect(plan.options[0].values.map((v) => v.id)).toEqual(["val-s", "val-m"]);
    expect(plan.variants.map((v) => v.id)).toEqual([
      "var-s-red",
      "var-s-blue",
      "var-m-red",
      "var-m-blue",
    ]);
    expect(plan.variants[0].links).toEqual([
      { optionId: "opt-size", valueId: "val-s" },
      { optionId: "opt-colour", valueId: "val-red" },
    ]);
  });

  test("adding a value keeps the old variants and mints only the new ones", () => {
    const plan = planVariantIds(
      options,
      variants,
      [
        { name: "Size", values: ["S", "M", "L"] },
        { name: "Colour", values: ["Red", "Blue"] },
      ],
      [row("S", "Red"), row("M", "Blue"), row("L", "Red")],
      ids(),
    );
    expect(plan.options[0].values.map((v) => v.id)).toEqual(["val-s", "val-m", "new-1"]);
    // var-s-blue and var-m-red are absent -> the RPC deletes them.
    expect(plan.variants.map((v) => v.id)).toEqual(["var-s-red", "var-m-blue", "new-2"]);
  });

  test("renaming an option at the same position keeps its values and variants", () => {
    const plan = planVariantIds(
      options,
      variants,
      [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red", "Blue"] },
      ],
      [row("S", "Red", "Color"), row("M", "Blue", "Color")],
      ids(),
    );
    expect(plan.options[1]).toMatchObject({ id: "opt-colour", name: "Color" });
    expect(plan.variants.map((v) => v.id)).toEqual(["var-s-red", "var-m-blue"]);
  });

  test("reordering options matches by name, not position", () => {
    const plan = planVariantIds(
      options,
      variants,
      [
        { name: "Colour", values: ["Red", "Blue"] },
        { name: "Size", values: ["S", "M"] },
      ],
      [
        {
          options: [
            { name: "Colour", value: "Blue" },
            { name: "Size", value: "M" },
          ],
        },
      ],
      ids(),
    );
    expect(plan.options.map((o) => [o.id, o.position])).toEqual([
      ["opt-colour", 0],
      ["opt-size", 1],
    ]);
    expect(plan.variants[0].id).toBe("var-m-blue");
  });

  test("removing an option replaces the variants (their combinations are gone)", () => {
    const plan = planVariantIds(
      options,
      variants,
      [{ name: "Size", values: ["S", "M"] }],
      [{ options: [{ name: "Size", value: "S" }] }],
      ids(),
    );
    expect(plan.options.map((o) => o.id)).toEqual(["opt-size"]);
    expect(plan.variants[0].id).toBe("new-1");
  });

  test("value matching ignores case and whitespace", () => {
    const plan = planVariantIds(
      options,
      variants,
      [
        { name: "size ", values: ["s", "M"] },
        { name: "Colour", values: ["red", "Blue"] },
      ],
      [row("s", "red")],
      ids(),
    );
    expect(plan.options[0].values[0]).toEqual({ id: "val-s", value: "s", position: 0 });
    expect(plan.variants[0].id).toBe("var-s-red");
  });

  test("a variant with only flat columns (half-written create) is still matched", () => {
    const flatOnly: ExistingVariant = { ...variants[0], links: [] };
    const plan = planVariantIds(
      options,
      [flatOnly],
      [
        { name: "Size", values: ["S"] },
        { name: "Colour", values: ["Red"] },
      ],
      [row("S", "Red")],
      ids(),
    );
    expect(plan.variants[0].id).toBe("var-s-red");
  });

  test("duplicate existing combinations are each claimed at most once", () => {
    const plan = planVariantIds(
      options,
      [variant("old", "S", "Red", "2026-10-01"), variant("dup", "S", "Red", "2026-10-02")],
      [
        { name: "Size", values: ["S"] },
        { name: "Colour", values: ["Red"] },
      ],
      [row("S", "Red")],
      ids(),
    );
    expect(plan.variants.map((v) => v.id)).toEqual(["old"]);
  });
});

describe("planRegularVariantId", () => {
  test("reuses the single variant", () => {
    expect(planRegularVariantId([{ id: "only", createdAt: "x", links: [], flat: [] }], ids())).toBe(
      "only",
    );
  });
  test("a product switched from variants keeps its oldest variant id", () => {
    expect(
      planRegularVariantId(
        [variant("b", "S", "Red", "2026-10-02"), variant("a", "M", "Red", "2026-10-01")],
        ids(),
      ),
    ).toBe("a");
  });
  test("no variants yet -> new id", () => {
    expect(planRegularVariantId([], ids())).toBe("new-1");
  });
});
