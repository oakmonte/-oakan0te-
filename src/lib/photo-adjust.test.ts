import { test, expect, describe } from "bun:test";
import {
  adjustToCss,
  isNeutralAdjust,
  NEUTRAL_ADJUST,
  ADJUST_CONTROLS,
  type PhotoAdjust,
} from "./photo-adjust";
import { compileFilter, withAmount, IDENTITY_FILTER } from "./canvas-filter";

const adj = (over: Partial<PhotoAdjust> = {}): PhotoAdjust => ({ ...NEUTRAL_ADJUST, ...over });

describe("adjustToCss", () => {
  // The bug this guards: returning "none" here was truthy, which killed
  // `if (!adjustCss) return grade` in compileGradeWithAdjust and took the
  // filter's intensity down with it — every export baked at full strength
  // while the preview honoured the slider.
  test("a neutral adjustment produces an empty string, not 'none'", () => {
    expect(adjustToCss(NEUTRAL_ADJUST)).toBe("");
  });

  // "none" is valid CSS only as a filter's sole value. As one term in a list
  // it voids the whole declaration, so the live preview silently loses the
  // grade as well.
  test("never emits the token 'none' as part of a longer filter list", () => {
    for (const { key } of ADJUST_CONTROLS) {
      const css = adjustToCss(adj({ [key]: 50 } as Partial<PhotoAdjust>));
      expect(css.split(/\s+/)).not.toContain("none");
    }
  });

  test("an empty result compiles to the identity filter by reference", () => {
    // Reference identity is what drawFilteredFrame's guard used to rely on.
    expect(compileFilter(adjustToCss(NEUTRAL_ADJUST))).toBe(IDENTITY_FILTER);
  });

  test("every emitted function is one compileFilter understands", () => {
    // A control that only works in the preview exports as a mismatch. This is
    // how `highlight()`/`shadow()` and `vignette()` escaped into a CSS filter
    // string: the browser drops unknown functions, compileFilter skips them.
    const known = ["brightness", "contrast", "saturate", "grayscale", "sepia", "hue-rotate"];
    for (const { key } of ADJUST_CONTROLS) {
      for (const value of [-100, -1, 1, 100]) {
        const css = adjustToCss(adj({ [key]: value } as Partial<PhotoAdjust>));
        const emitted = [...css.matchAll(/([\w-]+)\(/g)].map(([, name]) => name);
        // Compared as a set difference so a failure names the control, the
        // slider position and the offending function in one line.
        expect({ key, value, unknown: emitted.filter((n) => !known.includes(n)) }).toEqual({
          key,
          value,
          unknown: [],
        });
      }
    }
  });
});

describe("isNeutralAdjust", () => {
  test("true only when every control sits at zero", () => {
    expect(isNeutralAdjust(NEUTRAL_ADJUST)).toBe(true);
    for (const { key } of ADJUST_CONTROLS) {
      expect(isNeutralAdjust(adj({ [key]: 1 } as Partial<PhotoAdjust>))).toBe(false);
    }
  });

  // Vignette is positional, so it contributes nothing to adjustToCss. The
  // "nothing was edited, return the original bytes" path in after-shot-export
  // tests this function rather than the CSS string for exactly this reason —
  // testing the string would hand back the untouched capture and drop the
  // seller's vignette.
  test("a vignette-only edit is not neutral, though it emits no CSS", () => {
    const vignetteOnly = adj({ vignette: 60 });
    expect(adjustToCss(vignetteOnly)).toBe("");
    expect(isNeutralAdjust(vignetteOnly)).toBe(false);
  });
});

describe("withAmount", () => {
  // Filter intensity rides on CompiledFilter.amount. Anything that rebuilds a
  // compiled filter has to carry it across or the slider stops reaching the
  // exported file.
  test("carries a partial intensity and collapses a full one", () => {
    const graded = compileFilter("saturate(1.4)");
    expect(withAmount(graded, 0.3).amount).toBe(0.3);
    expect(withAmount(graded, 1).amount).toBeUndefined();
  });

  test("compounds rather than replacing an existing amount", () => {
    const half = withAmount(compileFilter("saturate(1.4)"), 0.5);
    expect(withAmount(half, 0.5).amount).toBeCloseTo(0.25);
  });

  test("leaves the identity filter alone", () => {
    expect(withAmount(IDENTITY_FILTER, 0.5)).toBe(IDENTITY_FILTER);
  });
});
