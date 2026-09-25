import { test, expect, describe } from "bun:test";
import { isHeldLight, surfaceForPathname } from "./surface";

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
    expect(surfaceForPathname("/profile/diadem")).toBe(null);
  });

  test("home and messages are the social surface, which follows the phone", () => {
    expect(surfaceForPathname("/home")).toBe("social");
    expect(surfaceForPathname("/messages")).toBe("social");
  });

  // Exact matches only — a prefix match would sweep in unrelated routes.
  test("routes that merely start with home or messages are not social", () => {
    expect(surfaceForPathname("/homepage")).toBe(null);
    expect(surfaceForPathname("/messages/archive")).toBe(null);
  });
});

describe("isHeldLight", () => {
  test("holds the screens that render product-form inline", () => {
    expect(isHeldLight("/store/products/new")).toBe(true);
    expect(isHeldLight("/store/products/7d3f2a90-1c1e-4c1b-9a55-0b1f6d7e2c11")).toBe(true);
    expect(isHeldLight("/store/collections/new")).toBe(true);
  });

  // Same prefix, fully converted -- they must follow the phone like the rest.
  test("does not hold the converted siblings", () => {
    expect(isHeldLight("/store/products/upload")).toBe(false);
    expect(isHeldLight("/store/products/newcomer")).toBe(false);
  });

  // product-form appears here only as a modal over a scrim, which stays legible.
  test("does not hold screens that only use product-form as a sheet", () => {
    expect(isHeldLight("/store/products")).toBe(false);
    expect(isHeldLight("/store/collections")).toBe(false);
    expect(isHeldLight("/store/collections/abc123")).toBe(false);
    expect(isHeldLight("/store/drops/abc123")).toBe(false);
  });

  // Unlike products/new and collections/new, most of this page is already
  // --sd-* -- only the embedded MediaSection is hardcoded light, the same
  // tradeoff already accepted for a sheet over a scrim.
  test("does not hold /store/drops/new -- only one inline piece is unconverted", () => {
    expect(isHeldLight("/store/drops/new")).toBe(false);
  });

  // A product decision, not the temporary product-form hold: the swatches
  // are storefront colours, and dark ones vanish on a dark page.
  test("holds the theme picker light", () => {
    expect(isHeldLight("/store/theme")).toBe(true);
  });

  test("never applies outside the dashboard", () => {
    expect(isHeldLight("/store")).toBe(false);
    expect(isHeldLight("/home")).toBe(false);
    expect(isHeldLight("/store-profile/diadem")).toBe(false);
  });
});
