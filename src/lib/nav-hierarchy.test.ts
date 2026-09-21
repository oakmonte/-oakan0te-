import { test, expect, describe } from "bun:test";
import { parentOf, targetPathname, isUnmanaged, pathTarget } from "./nav-hierarchy";

const ME = { ownUsername: "diadem" };
const NO_SEARCH = {};

describe("roots", () => {
  // A root must return null, because that is what puts it at the bottom of the
  // history stack and lets the iOS edge swipe leave the app instead of
  // replaying wherever the user happened to be twenty taps ago.
  test("tab roots have nothing above them", () => {
    for (const path of ["/", "/home", "/messages", "/cart"]) {
      expect(parentOf(path, NO_SEARCH, ME)).toBeNull();
    }
  });

  test("your own profile is a root, someone else's is not", () => {
    expect(parentOf("/profile/diadem", NO_SEARCH, ME)).toBeNull();
    expect(parentOf("/profile/other-person", NO_SEARCH, ME)).toEqual({ to: "/home" });
  });

  // Before the username loads there is no way to name the profile route, and
  // guessing wrong would send the user to a stranger's page.
  test("falls back to /home while the username is still unknown", () => {
    expect(parentOf("/settings", NO_SEARCH, {})).toEqual({ to: "/home" });
  });
});

describe("unmanaged trees", () => {
  // The camera flow returns by origin, not by stack: publish reads
  // media.origin, after-shot self-evicts once the capture is consumed, and the
  // camera uses getLastNonCreateRoute because history.back() is unreliable in
  // the Instagram/TikTok webview. A generic parent would fight all three.
  test("the create flow and onboarding manage their own returns", () => {
    for (const path of [
      "/create",
      "/create/after-shot",
      "/create/after-shot/publish",
      "/choose-username",
      "/welcome",
    ]) {
      expect(isUnmanaged(path)).toBe(true);
      expect(parentOf(path, NO_SEARCH, ME)).toBeNull();
    }
  });

  test("a prefix match does not swallow unrelated routes", () => {
    expect(isUnmanaged("/created-something")).toBe(false);
  });
});

describe("settings and profile", () => {
  test("settings goes up to your profile, not to the landing page", () => {
    // The bug this guards: `navigate({ to: ".." })` on a FLAT route resolves
    // to "/", which is the marketing page, not the profile it was opened from.
    expect(parentOf("/settings", NO_SEARCH, ME)).toEqual({
      to: "/profile/$username",
      params: { username: "diadem" },
    });
  });

  // Reachable from the landing footer as well as from Settings, so there is
  // no single parent, and "up" must not mean a sign-in wall for a signed-out
  // reader who followed a link to the terms.
  test("public legal pages are left unmanaged", () => {
    expect(isUnmanaged("/terms")).toBe(true);
    expect(parentOf("/privacy", NO_SEARCH, ME)).toBeNull();
  });

  // /edit-profile is reachable from Settings AND straight from the profile
  // header, so the static answer is only a fallback — useBack prefers whichever
  // is actually behind us in the stack.
  test("edit-profile falls back to the profile", () => {
    expect(parentOf("/edit-profile", NO_SEARCH, ME)).toEqual({
      to: "/profile/$username",
      params: { username: "diadem" },
    });
  });
});

describe("the store tree", () => {
  test("dashboard siblings collapse to /store, not to each other", () => {
    for (const path of ["/store/orders", "/store/customers", "/store/finance"]) {
      expect(parentOf(path, NO_SEARCH, ME)).toEqual({ to: "/store" });
    }
  });

  test("escaped child routes go back to the list that opened them", () => {
    expect(parentOf("/store/products/new", NO_SEARCH, ME)).toEqual({ to: "/store/products" });
    expect(parentOf("/store/products/abc123", NO_SEARCH, ME)).toEqual({ to: "/store/products" });
    expect(parentOf("/store/collections/xyz", NO_SEARCH, ME)).toEqual({
      to: "/store/collections",
    });
  });

  // These screens carry ?checklist=true precisely so they can return to the
  // setup checklist, which lives on /store itself, rather than their nav parent.
  test("a checklist deep link returns to the checklist", () => {
    expect(parentOf("/store/products/new", { checklist: true }, ME)).toEqual({ to: "/store" });
  });

  test("the dashboard itself goes up to your profile", () => {
    expect(parentOf("/store", NO_SEARCH, ME)).toEqual({
      to: "/profile/$username",
      params: { username: "diadem" },
    });
  });

  // "/store-profile/..." starts with "/store" as a string but is the public
  // storefront, not the dashboard — the same trap __root.tsx documents.
  test("the storefront is not mistaken for the dashboard", () => {
    expect(parentOf("/store-profile/acme", NO_SEARCH, ME)).toEqual({
      to: "/profile/$username",
      params: { username: "diadem" },
    });
  });
});

describe("targetPathname", () => {
  test("interpolates params so the stack can be searched for the result", () => {
    expect(targetPathname({ to: "/profile/$username", params: { username: "diadem" } })).toBe(
      "/profile/diadem",
    );
    expect(targetPathname({ to: "/store/products" })).toBe("/store/products");
    expect(targetPathname(pathTarget("/store/products/abc"))).toBe("/store/products/abc");
  });
});
