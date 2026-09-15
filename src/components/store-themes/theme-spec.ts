import type { FontId } from "./fonts";
import type { ThemeId } from "./types";

// A theme expressed as data instead of another copy of the same JSX.
//
// The eight original themes are hand-written components because each owns a
// genuinely bespoke hero. Everything since is a spec: the blocks below the
// hero were always shared (full-preview-blocks.tsx), and the hero itself
// varies along a small number of axes — palette, type, alignment, one
// decoration. Writing those out as ~25 lines of data per theme rather than
// ~115 lines of near-identical markup is what makes a catalogue of dozens
// maintainable; see the "config exercise, not bespoke JSX" note in the
// store-themes skill, which this finally makes true.
export type HeroDecor =
  /** Flat — the background colour carries the whole hero. */
  | { kind: "none" }
  /** Faint ruled grid, fading down. Technical, structured. */
  | { kind: "grid" }
  /** Soft radial bloom of the accent behind the headline. */
  | { kind: "glow"; at?: string }
  /** Linear band across the top, accent into background. */
  | { kind: "wash" }
  /** Two large blurred circles — the loosest, most editorial option. */
  | { kind: "orbs" }
  /** Thin corner rules, like a viewfinder. */
  | { kind: "brackets" };

export type ThemeSpec = {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  demoBrand: string;

  /** Storefront background. */
  bg: string;
  /** Primary text on that background. */
  ink: string;
  /** The one colour that carries the theme. */
  accent: string;

  /** Hero headline face, and the face for everything else. */
  heading: FontId;
  body: FontId;

  heroAlign: "left" | "center";
  heroSize: number;
  heroUppercase?: boolean;
  /** The short horizontal rule some themes set under the headline. */
  rule?: boolean;
  decor: HeroDecor;

  copy: {
    eyebrow: string;
    sub: string;
    /** Wording only — the number beside it is the store's real follower
     * count. See StatsRow. */
    followers: string;
    footer: string;
    promoEyebrow: string;
    promoTitle: string;
    promoCta: string;
  };

  collections: [string, string, string, string];
  counts: [number, number, number, number];
  products: [string, string, string, string];
  prices: [number, number, number, number];
};

// ── colour helpers ─────────────────────────────────────────────────────────
// Specs carry one accent and one ink; every tint, wash and avatar colour is
// derived from those so a theme can't drift out of tune with itself.

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.substring(0, 2), 16),
    parseInt(full.substring(2, 4), 16),
    parseInt(full.substring(4, 6), 16),
  ];
}

/** `hex` at `alpha` opacity, as an rgba() string. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Toward white for amount > 0, toward black for amount < 0. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => clampByte(c + (target - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** True when a background is dark enough to need light text on it. */
export function isDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/** The three overlapping avatar dots, light → dark through the accent. */
export function clusterFrom(accent: string): [string, string, string] {
  return [shade(accent, 0.4), accent, shade(accent, -0.45)];
}

/** The accent pushed until small text in it is actually readable on `bg`.
 *
 *  A theme's accent is chosen to look right as a FILL — a tile tint, a promo
 *  card, an avatar dot — and several of the brighter pastels land around
 *  2:1 against their own pale background, which is unreadable at the 11-12px
 *  the hero eyebrow and "View all" are set in. Rather than dulling those
 *  palettes at source, the fills keep the raw accent and only the strokes and
 *  text take this darker (or, on a dark ground, lighter) version, so a theme
 *  reads as bright and is still legible.
 *
 *  Derived rather than hand-tuned per theme: hand-tuning is a value that
 *  silently rots the next time a palette changes. */
export function readableAccent(accent: string, bg: string, target = 4.5): string {
  const toward = isDark(bg) ? 0.06 : -0.06;
  let current = accent;
  // ~16 steps is enough to cross the whole range; the guard is the loop
  // bound, not a hope that it converges.
  for (let i = 0; i < 16; i += 1) {
    if (contrastRatio(current, bg) >= target) return current;
    current = shade(current, toward);
  }
  return current;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
