import { expect, test } from "bun:test";
import { clipZoomAt, zoomPresetOf } from "./render";

const clip = (zoom?: { from: number; to: number }) => ({ inPoint: 2, outPoint: 6, zoom });

test("no zoom is scale 1; a close-up holds its scale", () => {
  expect(clipZoomAt(clip(), 3)).toBe(1);
  expect(clipZoomAt(clip({ from: 1.35, to: 1.35 }), 5)).toBe(1.35);
});

test("a push in eases from its start scale to its end scale over the clip", () => {
  const push = clip({ from: 1, to: 1.2 });
  expect(clipZoomAt(push, 2)).toBe(1);
  expect(clipZoomAt(push, 4)).toBeCloseTo(1.1);
  expect(clipZoomAt(push, 6)).toBeCloseTo(1.2);
  // Before and after the clip it holds, rather than overshooting.
  expect(clipZoomAt(push, 9)).toBeCloseTo(1.2);
});

test("presets round-trip", () => {
  expect(zoomPresetOf(undefined)).toBe("none");
  expect(zoomPresetOf({ from: 1, to: 1.2 })).toBe("in");
  expect(zoomPresetOf({ from: 1.7, to: 1 })).toBe("none");
});
