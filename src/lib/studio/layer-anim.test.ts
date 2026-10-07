import { describe, expect, test } from "bun:test";
import { animateLayer } from "./layer-anim";
import { TEXT_DEFAULTS, type TimedLayer } from "./types";

function caption(anim: TimedLayer["anim"]): TimedLayer {
  return {
    ...TEXT_DEFAULTS,
    id: "c",
    kind: "text",
    content: "New in",
    startTime: 2,
    endTime: 6,
    anim,
  } as TimedLayer;
}

describe("animateLayer", () => {
  test("no animation, or past the entrance: the layer itself", () => {
    const still = caption(undefined);
    expect(animateLayer(still, 2.1)).toBe(still);
    const pop = caption("pop");
    expect(animateLayer(pop, 3)).toBe(pop);
  });

  test("pop starts small and settles at full size", () => {
    const pop = caption("pop");
    expect(animateLayer(pop, 2).scale).toBeLessThan(0.2);
    expect(animateLayer(pop, 2.34).scale).toBeCloseTo(1, 1);
  });

  test("slide starts below and rises into place", () => {
    const slide = caption("slide");
    expect(animateLayer(slide, 2).y).toBeCloseTo(slide.y + 0.1);
    expect(animateLayer(slide, 2.2).y).toBeGreaterThan(slide.y);
  });

  test("typewriter reveals the text a character at a time", () => {
    const type = caption("typewriter");
    const at = (t: number) => (animateLayer(type, t) as { content: string }).content;
    expect(at(2)).toBe("N");
    expect(at(2.6).length).toBeGreaterThan(1);
    expect(at(2.6).length).toBeLessThan(6);
    expect(at(4)).toBe("New in");
  });
});
