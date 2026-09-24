import { describe, expect, test } from "bun:test";
import { edgeSwipeBlocked, resolveSwipeAction, rubberBand, shouldCommit } from "./edge-swipe";

const base = {
  pathname: "/settings",
  overlayOpen: false,
  hasScreenBack: false,
  hasHierarchyParent: true,
  stackIndex: 2,
};

describe("resolveSwipeAction", () => {
  test("an open overlay closes before anything navigates", () => {
    expect(resolveSwipeAction({ ...base, overlayOpen: true, hasScreenBack: true })).toBe(
      "close-overlay",
    );
  });

  test("the screen's own back button wins over the hierarchy", () => {
    expect(resolveSwipeAction({ ...base, hasScreenBack: true })).toBe("screen-back");
  });

  test("otherwise goes up the hierarchy", () => {
    expect(resolveSwipeAction(base)).toBe("up");
  });

  test("a root has nowhere to go, however deep the stack", () => {
    expect(
      resolveSwipeAction({ ...base, pathname: "/home", hasHierarchyParent: false, stackIndex: 5 }),
    ).toBe("none");
  });

  test("unmanaged screens fall back to history, but only if there is some", () => {
    const terms = { ...base, pathname: "/terms", hasHierarchyParent: false };
    expect(resolveSwipeAction(terms)).toBe("history");
    expect(resolveSwipeAction({ ...terms, stackIndex: 0 })).toBe("none");
  });
});

describe("edgeSwipeBlocked", () => {
  test("the camera and editors keep the edge", () => {
    expect(edgeSwipeBlocked("/create")).toBe(true);
    expect(edgeSwipeBlocked("/create/after-shot/studio")).toBe(true);
  });
  test("a lookalike path does not", () => {
    expect(edgeSwipeBlocked("/create-password")).toBe(false);
    expect(edgeSwipeBlocked("/settings")).toBe(false);
  });
});

describe("shouldCommit", () => {
  test("past a third of the width commits", () => {
    expect(shouldCommit(140, 0, 390)).toBe(true);
    expect(shouldCommit(120, 0, 390)).toBe(false);
  });
  test("a flick commits from a short distance", () => {
    expect(shouldCommit(40, 0.6, 390)).toBe(true);
    expect(shouldCommit(20, 0.6, 390)).toBe(false);
  });
  test("moving back towards the edge cancels, even when far across", () => {
    expect(shouldCommit(300, -0.5, 390)).toBe(false);
  });
});

describe("rubberBand", () => {
  test("never passes the cap and never goes negative", () => {
    expect(rubberBand(-10)).toBe(0);
    expect(rubberBand(10_000)).toBeLessThan(56);
    expect(rubberBand(40)).toBeGreaterThan(rubberBand(20));
  });
});
