import { expect, test } from "bun:test";
import { blocksBelowGrid } from "./layout-presets";

test("each layout's blocks below the grid", () => {
  expect(blocksBelowGrid("hero-led", [], true)).toEqual(["promo", "footer"]);
  expect(blocksBelowGrid("shop-first", [], true)).toEqual(["stats", "promo", "footer"]);
  expect(blocksBelowGrid("social-proof", [], true)).toEqual(["footer"]);
  expect(blocksBelowGrid("editorial", [], true)).toEqual(["stats", "footer"]);
});

test("hidden blocks, and the drop banner with no drop, don't count", () => {
  expect(blocksBelowGrid("hero-led", [], false)).toEqual(["footer"]);
  expect(blocksBelowGrid("social-proof", ["footer"], true)).toEqual([]);
  expect(blocksBelowGrid("editorial", ["stats", "footer"], false)).toEqual([]);
});
