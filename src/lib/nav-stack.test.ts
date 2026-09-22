import { test, expect, describe, beforeEach } from "bun:test";
import {
  currentIndex,
  findAncestor,
  noteExternalPush,
  readIndex,
  reset,
  shouldRemoveOverlayEntry,
  __setStateForTest,
} from "./nav-stack";

beforeEach(() => reset());

describe("readIndex", () => {
  // We reuse @tanstack/history's own __TSR_index rather than inventing one, so
  // the mirror cannot drift from the router's idea of position and cannot
  // collide with scroll restoration, which shares that state object.
  test("reads the router's index off history state", () => {
    expect(readIndex({ __TSR_index: 3 })).toBe(3);
  });

  test("treats anything unrecognisable as the bottom of the stack", () => {
    expect(readIndex(null)).toBe(0);
    expect(readIndex({})).toBe(0);
    expect(readIndex({ __TSR_index: -1 })).toBe(0);
  });
});

describe("findAncestor", () => {
  test("reports how far back a screen sits", () => {
    __setStateForTest(
      [{ pathname: "/home" }, { pathname: "/settings" }, { pathname: "/edit-profile" }],
      2,
    );
    expect(findAncestor("/home")).toBe(0);
    expect(findAncestor("/settings")).toBe(1);
  });

  test("never matches the current entry or anything above it", () => {
    __setStateForTest([{ pathname: "/home" }, { pathname: "/settings" }], 0);
    expect(findAncestor("/settings")).toBe(-1);
    expect(findAncestor("/home")).toBe(-1);
  });

  // The case that makes /edit-profile work: it can be opened from Settings or
  // straight from the profile, and the right parent is whichever is nearer.
  test("the nearest occurrence wins", () => {
    __setStateForTest(
      [
        { pathname: "/profile/diadem" },
        { pathname: "/settings" },
        { pathname: "/profile/diadem" },
        { pathname: "/edit-profile" },
      ],
      3,
    );
    expect(findAncestor("/profile/diadem")).toBe(2);
  });

  // A reload or BFCache restore lands us at a non-zero index with nothing below
  // it known. Missing must mean "fall back to hierarchy navigation", not "guess".
  test("unknown entries below us simply miss", () => {
    __setStateForTest([undefined, undefined, { pathname: "/settings" }], 2);
    expect(findAncestor("/home")).toBe(-1);
    expect(currentIndex()).toBe(2);
  });
});

describe("noteExternalPush", () => {
  test("records an overlay entry above the current screen", () => {
    __setStateForTest([{ pathname: "/home" }], 0);
    noteExternalPush("/home");
    expect(currentIndex()).toBe(1);
    expect(findAncestor("/home")).toBe(0);
  });

  // Forward entries are gone from the browser's stack after a push, so keeping
  // them would let findAncestor pop to a screen the user cannot reach.
  test("discards anything that was ahead of us", () => {
    __setStateForTest(
      [{ pathname: "/home" }, { pathname: "/settings" }, { pathname: "/terms" }],
      0,
    );
    noteExternalPush("/home");
    expect(findAncestor("/terms")).toBe(-1);
    expect(currentIndex()).toBe(1);
  });
});

describe("shouldRemoveOverlayEntry", () => {
  const PAGE = "/profile/diadem";
  const ELSEWHERE = "/store";

  test("does nothing when the back gesture already popped the entry", () => {
    expect(
      shouldRemoveOverlayEntry({ poppedByGesture: true, hrefAtOpen: PAGE, hrefNow: PAGE }),
    ).toBe(false);
  });

  test("removes the entry when the overlay is dismissed in place", () => {
    // Tap-outside, a close button, a confirm: nothing navigated, so our entry
    // is still the one on top. Leaving it would swallow the next back press.
    expect(
      shouldRemoveOverlayEntry({ poppedByGesture: false, hrefAtOpen: PAGE, hrefNow: PAGE }),
    ).toBe(true);
  });

  test("leaves the entry alone when a menu row navigated away", () => {
    // Tapping "Oakmonte Store" in the profile menu: the route committed, the
    // profile unmounted, and an unconditional history.back() in the cleanup
    // popped that navigation straight back off. The store flashed up and
    // vanished, and every row in that menu was dead the same way.
    expect(
      shouldRemoveOverlayEntry({ poppedByGesture: false, hrefAtOpen: PAGE, hrefNow: ELSEWHERE }),
    ).toBe(false);
  });

  test("compares the ROUTER href, which moves before window.history does", () => {
    // The second bug, and the reason this takes hrefs rather than indexes.
    // "Return to profile" in the store drawer closes the sheet and navigates in
    // ONE click. @tanstack/history defers the real window.history.pushState to
    // a microtask, so at cleanup time window.history.state still described the
    // sentinel and an index comparison saw no navigation at all -- it popped,
    // the push then landed, and the queued pop undid it. The router's own
    // location is updated synchronously, so it already reads as the new href
    // here and the entry is correctly left alone.
    expect(
      shouldRemoveOverlayEntry({ poppedByGesture: false, hrefAtOpen: PAGE, hrefNow: ELSEWHERE }),
    ).toBe(false);
  });

  test("treats a search-only change as having navigated", () => {
    expect(
      shouldRemoveOverlayEntry({
        poppedByGesture: false,
        hrefAtOpen: "/store/finance",
        hrefNow: "/store/finance?checklist=true",
      }),
    ).toBe(false);
  });
});
