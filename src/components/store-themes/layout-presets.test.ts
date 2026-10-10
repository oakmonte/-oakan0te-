import { expect, test } from "bun:test";
import {
  blocksBelowGrid,
  liveOrder,
  pickableLayouts,
  resolveStickyBottom,
  sameLiveOrder,
  stickyOptionAvailable,
} from "./layout-presets";

// Follower count ("stats") and community footer ("footer") are retired for
// sellers-only (RETIRED_BLOCKS), so they never count as below the grid.
test("each layout's blocks below the grid", () => {
  expect(blocksBelowGrid("hero-led", [], true)).toEqual(["promo"]);
  expect(blocksBelowGrid("shop-first", [], true)).toEqual(["promo"]);
  expect(blocksBelowGrid("social-proof", [], true)).toEqual([]);
  expect(blocksBelowGrid("editorial", [], true)).toEqual([]);
});

test("hidden blocks, and the drop banner with no drop, don't count", () => {
  expect(blocksBelowGrid("hero-led", [], false)).toEqual([]);
  expect(blocksBelowGrid("hero-led", ["promo"], true)).toEqual([]);
});

test("retired blocks drop out of every layout's order", () => {
  expect(liveOrder("hero-led")).toEqual(["collections", "promo"]);
  expect(liveOrder("editorial")).toEqual(["promo", "collections"]);
});

test("the picker offers one preset per distinct order, and ticks equivalents", () => {
  expect(pickableLayouts().map((p) => p.id)).toEqual(["shop-first", "editorial"]);
  expect(sameLiveOrder("shop-first", "hero-led")).toBe(true);
  expect(sameLiveOrder("editorial", "social-proof")).toBe(true);
  expect(sameLiveOrder("hero-led", "editorial")).toBe(false);
});

test("stick-to-page: the seller's choice wins, otherwise more than 10 items", () => {
  // A saved "on" doesn't survive dropping to the threshold or below, where
  // the toggle to turn it off is hidden.
  expect(resolveStickyBottom(true, 0)).toBe(false);
  expect(resolveStickyBottom(true, 10)).toBe(false);
  expect(resolveStickyBottom(true, 11)).toBe(true);
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
