// The one liquid-glass recipe. Every floating surface — the bottom nav, the
// home shop/explore toggle, the camera and editor controls, the messages
// panels, the toasts — spreads one of these instead of hand-tuning its own, so
// they read as one material. See the `liquid-glass` skill for when to use it
// (floating chrome over content) and when not to (sheets, cards, headers).
//
// What makes it read as glass rather than a translucent box, in order of how
// much each matters:
//   1. A light tint over a SHARP, very saturated blur. Heavy blur is frosted
//      plastic; glass lets shapes through and makes their colour richer.
//   2. The rim — `className={GLASS_RIM}` — a 1px edge that is bright where
//      light would catch it (top-left, bottom-right) and nearly gone along
//      the sides. A uniform border is what makes a pill look drawn.
//   3. Light inside the edge: a top highlight, a fainter bottom one where the
//      light exits, and a soft inner glow that gives the surface thickness.
//   4. A soft, low drop shadow so it floats.
//
// Inline objects rather than Tailwind: Tailwind's blur utilities have no
// saturate()/brightness(), and the multi-layer shadows would be unreadable as
// arbitrary values. The rim needs a pseudo-element, which inline styles can't
// express, so it is the one piece that lives in styles.css.
import type { CSSProperties } from "react";

/** Add to the element's className alongside a preset. The element must be
 *  positioned (relative/absolute/fixed) — the rim is an absolute ::before. */
export const GLASS_RIM = "oak-glass-rim";

type GlassStyle = CSSProperties & { "--oak-rim"?: number };

function backdrop(filter: string): CSSProperties {
  return { backdropFilter: filter, WebkitBackdropFilter: filter };
}

/** Over photos and video with dark content (icons, labels) on top: the bottom
 *  nav, the shop/explore toggle. Tint high enough that black icons still read
 *  over a dark video frame; brightness lifts what shows through. */
export const glassLight: GlassStyle = {
  background: "rgba(255,255,255,0.3)",
  ...backdrop("blur(14px) saturate(210%) brightness(1.12)"),
  boxShadow: [
    "0 12px 32px rgba(0,0,0,0.22)",
    "0 2px 6px rgba(0,0,0,0.10)",
    "inset 0 1px 0.5px rgba(255,255,255,0.8)",
    "inset 0 -1px 0.5px rgba(255,255,255,0.3)",
    "inset 0 0 16px rgba(255,255,255,0.22)",
  ].join(", "),
  "--oak-rim": 1,
};

/** The selected lens sliding inside a glassLight track: a brighter, thicker
 *  drop of glass rather than an opaque white pill. */
export const glassLens: GlassStyle = {
  background: "rgba(255,255,255,0.58)",
  ...backdrop("blur(6px) saturate(240%) brightness(1.18)"),
  boxShadow: [
    "0 4px 14px rgba(0,0,0,0.16)",
    "inset 0 1.5px 1px rgba(255,255,255,1)",
    "inset 0 -1.5px 1px rgba(255,255,255,0.5)",
    "inset 0 0 12px rgba(255,255,255,0.45)",
  ].join(", "),
  "--oak-rim": 1,
};

/** Small round controls floating over the live camera or media being edited,
 *  always with WHITE icons. The tint is dark, not white: a white-tinted clear
 *  glass left white icons with nothing to stand on over a bright scene — a
 *  white wall, a sky, a pale photo — and they vanished (reported on device
 *  2026-09-24). Darkening what shows through (`brightness(0.8)`) as well as
 *  tinting keeps the contrast even when the background is pure white, while
 *  staying light enough over a dark scene to still read as glass. The white
 *  icons also get a soft drop shadow from styles.css (`.oak-glass-rim > svg`).
 */
export const glassClear: GlassStyle = {
  background: "rgba(16,16,18,0.30)",
  ...backdrop("blur(12px) saturate(180%) brightness(0.8)"),
  boxShadow: [
    "0 6px 18px rgba(0,0,0,0.22)",
    "inset 0 1px 0.5px rgba(255,255,255,0.4)",
    "inset 0 -1px 0.5px rgba(255,255,255,0.1)",
    "inset 0 0 10px rgba(255,255,255,0.06)",
  ].join(", "),
  "--oak-rim": 0.7,
};

/** Dark glass for white content that must stay legible over anything: the
 *  messages panels, toasts. */
export const glassDark: GlassStyle = {
  background: "rgba(24,26,30,0.58)",
  ...backdrop("blur(18px) saturate(190%)"),
  boxShadow: [
    "0 14px 38px rgba(0,0,0,0.38)",
    "inset 0 1px 0.5px rgba(255,255,255,0.28)",
    "inset 0 -1px 0.5px rgba(255,255,255,0.08)",
    "inset 0 0 14px rgba(255,255,255,0.05)",
  ].join(", "),
  "--oak-rim": 0.5,
};
