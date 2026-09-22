import { test, expect, describe } from "bun:test";
import { surfaceForPathname } from "./surface";

describe("surfaceForPathname", () => {
  test("the dashboard root and its children are the store surface", () => {
    expect(surfaceForPathname("/store")).toBe("store");
    expect(surfaceForPathname("/store/products")).toBe("store");
    expect(surfaceForPathname("/store/finance")).toBe("store");
  });

  // The trailing-underscore routes opt out of an intermediate layout, not out
  // of /store. They are still the dashboard and still have to be white.
  test("trailing-underscore routes are still the dashboard", () => {
    expect(surfaceForPathname("/store/products/new")).toBe("store");
    expect(surfaceForPathname("/store/products/upload")).toBe("store");
    expect(surfaceForPathname("/store/locations/new")).toBe("store");
    expect(surfaceForPathname("/store/collections/new")).toBe("store");
  });

  // The one that bites: a public storefront is not the seller's dashboard, and
  // it begins with "/store" as a plain string. Painting it in dashboard chrome
  // would show a shopper the seller's white admin surface.
  test("the public storefront is NOT the dashboard", () => {
    expect(surfaceForPathname("/store-profile/diadem")).toBe(null);
    expect(surfaceForPathname("/store-profile/vintage")).toBe(null);
  });

  // Same trap, other direction: these merely share a prefix and are their own
  // (black) screens.
  test("other routes that merely start with 'store' are not the dashboard", () => {
    expect(surfaceForPathname("/name-your-store")).toBe(null);
    expect(surfaceForPathname("/set-up-store")).toBe(null);
    expect(surfaceForPathname("/storefront")).toBe(null);
  });

  test("the publish screen is its own white surface", () => {
    expect(surfaceForPathname("/create/after-shot/publish")).toBe("publish");
  });

  // The rest of the create flow is a camera editor and stays black.
  test("the rest of the create flow is not white", () => {
    expect(surfaceForPathname("/create")).toBe(null);
    expect(surfaceForPathname("/create/after-shot")).toBe(null);
    expect(surfaceForPathname("/create/after-shot/studio")).toBe(null);
  });

  test("the dark screens report no surface", () => {
    expect(surfaceForPathname("/")).toBe(null);
    expect(surfaceForPathname("/home")).toBe(null);
    expect(surfaceForPathname("/messages")).toBe(null);
    expect(surfaceForPathname("/profile/diadem")).toBe(null);
  });
});
