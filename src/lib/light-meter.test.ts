import { describe, expect, test } from "bun:test";
import { liftForMean } from "./light-meter";

describe("liftForMean", () => {
  test("leaves a bright enough scene alone", () => {
    expect(liftForMean(0.42)).toBe(1);
    expect(liftForMean(0.8)).toBe(1);
  });

  test("never lifts a black frame (covered lens, camera starting)", () => {
    expect(liftForMean(0)).toBe(1);
    expect(liftForMean(0.01)).toBe(1);
    expect(liftForMean(Number.NaN)).toBe(1);
  });

  test("brightens a dim scene part of the way, more the darker it is", () => {
    const dim = liftForMean(0.3);
    const dark = liftForMean(0.18);
    expect(dim).toBeLessThan(1);
    expect(dark).toBeLessThan(dim);
    // Partial: a 0.3 scene ends brighter, but short of the 0.42 target.
    const lifted = Math.pow(0.3, dim);
    expect(lifted).toBeGreaterThan(0.3);
    expect(lifted).toBeLessThan(0.42);
  });

  test("caps the lift however dark it gets", () => {
    expect(liftForMean(0.03)).toBeGreaterThanOrEqual(0.62);
  });
});
