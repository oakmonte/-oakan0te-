import { expect, test } from "bun:test";
import { THEME_SPECS, specForTheme } from "./theme-specs";
import { alpha, clusterFrom, isDark, readableAccent, shade } from "./theme-spec";
import { FONT_OPTIONS } from "./fonts";
import { THEMES } from "./types";

// The catalogue is data now, and data is exactly what silently rots: a theme
// with a mistyped hex renders rgba(NaN,NaN,NaN) rather than throwing, and a
// theme whose slug never reached the ThemeId union or store_themes looks
// selectable and then reverts with no error anywhere. None of that is visible
// in a screenshot of one theme, and there are 49 of them.

const HEX = /^#[0-9a-fA-F]{6}$/;

function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const channel = (i: number) => {
    const c = parseInt(n.substring(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("every spec has a well-formed palette", () => {
  for (const spec of THEME_SPECS) {
    for (const [key, value] of [
      ["bg", spec.bg],
      ["ink", spec.ink],
      ["accent", spec.accent],
    ] as const) {
      expect(`${spec.id}.${key}=${value}`).toMatch(new RegExp(`${key}=#[0-9a-fA-F]{6}$`));
      expect(HEX.test(value)).toBe(true);
    }
  }
});

test("derived colours never produce NaN", () => {
  for (const spec of THEME_SPECS) {
    expect(alpha(spec.ink, 0.58)).not.toContain("NaN");
    expect(alpha(spec.accent, 0.08)).not.toContain("NaN");
    for (const c of clusterFrom(spec.accent)) expect(HEX.test(c)).toBe(true);
    expect(HEX.test(shade(spec.accent, 0.4))).toBe(true);
    expect(HEX.test(shade(spec.accent, -0.45))).toBe(true);
  }
});

test("body copy stays readable on every theme", () => {
  for (const spec of THEME_SPECS) {
    // 7:1 is AAA for body text. These are storefronts people read on a phone
    // in daylight, so the bar is the higher one.
    expect(`${spec.id}:${contrast(spec.ink, spec.bg).toFixed(2)}`).toBe(
      `${spec.id}:${Math.max(contrast(spec.ink, spec.bg), 7).toFixed(2)}`,
    );
  }
});

test("readableAccent lifts every accent to AA for small text", () => {
  for (const spec of THEME_SPECS) {
    const ink = readableAccent(spec.accent, spec.bg);
    // The hero eyebrow and "View all" render in this colour at 11-12px.
    expect(contrast(ink, spec.bg)).toBeGreaterThanOrEqual(4.5);
    expect(HEX.test(ink)).toBe(true);
  }
});

test("readableAccent moves away from the background, not toward it", () => {
  for (const spec of THEME_SPECS) {
    const ink = readableAccent(spec.accent, spec.bg);
    const before = contrast(spec.accent, spec.bg);
    const after = contrast(ink, spec.bg);
    expect(after).toBeGreaterThanOrEqual(Math.min(before, 4.5) - 0.001);
    // On a dark ground it should lighten, on a light ground darken.
    if (ink !== spec.accent) {
      const lifted = relativeLuminance(ink) > relativeLuminance(spec.accent);
      expect(lifted).toBe(isDark(spec.bg));
    }
  }
});

test("every spec font id exists in FONT_OPTIONS", () => {
  const ids = new Set(FONT_OPTIONS.map((f) => f.id));
  for (const spec of THEME_SPECS) {
    expect(ids.has(spec.heading)).toBe(true);
    expect(ids.has(spec.body)).toBe(true);
  }
});

test("spec ids are unique and all appear in THEMES", () => {
  const ids = THEME_SPECS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  const themeIds = new Set(THEMES.map((t) => t.id));
  for (const id of ids) expect(themeIds.has(id)).toBe(true);
});

test("THEMES never disagrees with the spec it came from", () => {
  for (const spec of THEME_SPECS) {
    const entry = THEMES.find((t) => t.id === spec.id);
    expect(entry).toBeDefined();
    expect(entry!.accent).toBe(spec.accent);
    expect(entry!.background).toBe(spec.bg);
    expect(entry!.name).toBe(spec.name);
  }
});

test("every spec fills all four placeholder tiles", () => {
  for (const spec of THEME_SPECS) {
    expect(spec.collections).toHaveLength(4);
    expect(spec.counts).toHaveLength(4);
    expect(spec.products).toHaveLength(4);
    expect(spec.prices).toHaveLength(4);
    for (const p of spec.prices) expect(p).toBeGreaterThan(0);
  }
});

test("specForTheme always returns a spec, including for an unknown slug", () => {
  // This is what FullPreview's default case leans on: a storefront in the
  // wrong theme beats undefined, which React throws on.
  expect(specForTheme("black-gold").id).toBe("black-gold");
  expect(specForTheme("no-such-theme" as never)).toBeDefined();
  expect(specForTheme("no-such-theme" as never).id).toBe(THEME_SPECS[0].id);
});

test("the two themes named in the brief exist and are black-grounded", () => {
  const gold = THEME_SPECS.find((s) => s.id === "black-gold");
  const red = THEME_SPECS.find((s) => s.id === "black-red");
  expect(gold).toBeDefined();
  expect(red).toBeDefined();
  expect(isDark(gold!.bg)).toBe(true);
  expect(isDark(red!.bg)).toBe(true);
});
