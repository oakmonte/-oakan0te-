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
  test("does nothing when the back gesture already popped the entry", () => {
    expect(shouldRemoveOverlayEntry({ poppedByGesture: true, ourIndex: 3, currentIndex: 2 })).toBe(
      false,
    );
  });

  test("removes the entry when the overlay is dismissed in place", () => {
    // Tap-outside, a close button, a confirm: nothing navigated, so our entry
    // is still the one on top. Leaving it would swallow the next back press.
    expect(shouldRemoveOverlayEntry({ poppedByGesture: false, ourIndex: 3, currentIndex: 3 })).toBe(
      true,
    );
  });

  test("leaves the entry alone when a menu row navigated away", () => {
    // The regression of 2026-09-22. Tapping "Oakmonte Store" in the profile
    // menu pushed /store over our entry, the profile route unmounted, and the
    // cleanup called history.back() unconditionally -- which popped the
    // navigation straight back off. The store flashed up and vanished, and
    // every row in that menu (Studio, Store, Activity, Offline videos,
    // Settings) was dead the same way.
    expect(shouldRemoveOverlayEntry({ poppedByGesture: false, ourIndex: 3, currentIndex: 4 })).toBe(
      false,
    );
  });

  test("leaves the entry alone after a multi-step navigation", () => {
    expect(shouldRemoveOverlayEntry({ poppedByGesture: false, ourIndex: 3, currentIndex: 7 })).toBe(
      false,
    );
  });

  test("does not pop when the stack is somehow already below us", () => {
    // Defensive: a go(-n) we did not observe. Popping again would take a real
    // page off the stack.
    expect(shouldRemoveOverlayEntry({ poppedByGesture: false, ourIndex: 3, currentIndex: 1 })).toBe(
      false,
    );
  });
});
