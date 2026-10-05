import { expect, test } from "bun:test";
import { blocksBelowGrid, resolveStickyBottom, stickyOptionAvailable } from "./layout-presets";

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

test("stick-to-page: the seller's choice wins, otherwise more than 10 items", () => {
  expect(resolveStickyBottom(true, 0)).toBe(true);
  expect(resolveStickyBottom(false, 500)).toBe(false);
  expect(resolveStickyBottom(null, 10)).toBe(false);
  expect(resolveStickyBottom(null, 11)).toBe(true);
  expect(resolveStickyBottom(null, null)).toBe(false);
});

test("the stick-to-page option is only offered above 10 items", () => {
  expect(stickyOptionAvailable(null)).toBe(false);
  expect(stickyOptionAvailable(10)).toBe(false);
  expect(stickyOptionAvailable(11)).toBe(true);
});
