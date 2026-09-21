import { test, expect, describe } from "bun:test";
import { vignetteCss } from "./vignette";
import { CAMERA_FILTERS, previewCssAtIntensity } from "@/components/camera/filter-data";

// The whole point of src/lib/vignette.ts is that there is exactly ONE vignette
// in the app. These pin the properties a second implementation would break.
describe("vignetteCss", () => {
  test("is off below 1, so callers can render unconditionally", () => {
    expect(vignetteCss(0)).toBe("none");
    expect(vignetteCss(-5)).toBe("none");
  });

  test("is an ellipse, not a circle", () => {
    // A circular gradient on a 9:16 frame crushes top and bottom far harder
    // than the sides. `ellipse` is what makes the CSS and the canvas agree.
    expect(vignetteCss(50)).toContain("ellipse at center");
  });

  test("alpha scales linearly with the slider and stays under 1", () => {
    const alphaOf = (v: number) =>
      Number(vignetteCss(v).match(/rgba\(0,0,0,([\d.]+)\)\s*100%/)![1]);
    expect(alphaOf(100)).toBeCloseTo(0.72, 3);
    expect(alphaOf(50)).toBeCloseTo(0.36, 3);
    expect(alphaOf(100)).toBeLessThan(1); // never fully black at the edge
  });

  test("the transparent centre starts at the same place at every strength", () => {
    // Preview and bake share VIGNETTE_INNER; if this moved with amount, the
    // canvas gradient (which reads the constant once) would stop matching.
    const innerOf = (v: number) => vignetteCss(v).match(/rgba\(0,0,0,0\)\s*([\d.]+)%/)![1];
    expect(innerOf(10)).toBe(innerOf(90));
  });
});

describe("no filter preset fakes a vignette", () => {
  // `vignette()` is not a CSS filter function. One invalid function invalidates
  // the entire `filter` declaration, so a preset carrying it previews as
  // completely unfiltered while the export still applies its grade.
  const CSS_FILTER_FNS = [
    "brightness",
    "contrast",
    "saturate",
    "grayscale",
    "sepia",
    "hue-rotate",
    "invert",
    "opacity",
    "blur",
    "drop-shadow",
  ];

  test("every previewCss uses only real CSS filter functions", () => {
    for (const f of CAMERA_FILTERS) {
      if (!f.previewCss || f.previewCss === "none") continue;
      const used = [...f.previewCss.matchAll(/([\w-]+)\(/g)].map(([, n]) => n);
      expect({ id: f.id, bad: used.filter((n) => !CSS_FILTER_FNS.includes(n)) }).toEqual({
        id: f.id,
        bad: [],
      });
    }
  });

  test("and still only real ones after the intensity slider rewrites them", () => {
    for (const f of CAMERA_FILTERS) {
      for (const intensity of [0, 35, 99]) {
        const css = previewCssAtIntensity(f, intensity);
        if (!css || css === "none") continue;
        const used = [...css.matchAll(/([\w-]+)\(/g)].map(([, n]) => n);
        expect({
          id: f.id,
          intensity,
          bad: used.filter((n) => !CSS_FILTER_FNS.includes(n)),
        }).toEqual({ id: f.id, intensity, bad: [] });
      }
    }
  });

  test("hue-rotate survives the intensity rewrite as hue-rotate", () => {
    // It once fell through into the vignette case and came out as vignette().
    const rotator = CAMERA_FILTERS.find((f) => f.previewCss?.includes("hue-rotate("));
    expect(rotator).toBeDefined();
    const scaled = previewCssAtIntensity(rotator!, 50);
    expect(scaled).toContain("hue-rotate(");
    expect(scaled).not.toContain("vignette(");
  });
});
