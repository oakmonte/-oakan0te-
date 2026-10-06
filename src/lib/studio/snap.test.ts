import { describe, expect, test } from "bun:test";
import { placeLane } from "./lanes";
import { snapSpan, snapTime } from "./snap";

describe("snapTime", () => {
  test("snaps to the nearest target inside the threshold", () => {
    expect(snapTime(2.04, [0, 2, 2.1], 0.1)).toEqual({ time: 2, target: 2 });
    expect(snapTime(2.08, [0, 2, 2.1], 0.1)).toEqual({ time: 2.1, target: 2.1 });
  });

  test("leaves the time alone when nothing is close", () => {
    expect(snapTime(5, [0, 2], 0.1)).toEqual({ time: 5, target: null });
  });
});

describe("snapSpan", () => {
  test("snaps the tail when it is the closer edge, keeping the length", () => {
    // Head is 0.08 from 1, tail 0.02 from 4: the tail wins.
    expect(snapSpan(1.08, 2.9, [1, 4], 0.1)).toEqual({ start: 1.1, target: 4 });
  });

  test("snaps the head when it is the closer edge", () => {
    expect(snapSpan(0.97, 2, [1, 4], 0.1)).toEqual({ start: 1, target: 1 });
  });

  test("no target in reach, no change", () => {
    expect(snapSpan(1.5, 1, [0, 4], 0.1)).toEqual({ start: 1.5, target: null });
  });
});

describe("placeLane", () => {
  const others = [{ start: 0, end: 2, lane: 0 }];
  test("takes the lane asked for when it's free there", () => {
    expect(placeLane(others, 3, 4, 0)).toBe(0);
    expect(placeLane(others, 1, 3, 2)).toBe(2);
  });

  test("falls back to the lowest free lane on a collision", () => {
    expect(placeLane(others, 1, 3, 0)).toBe(1);
  });
});
