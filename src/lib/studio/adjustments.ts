// Turns a filter preset id + an Adjustments record into ONE CSS filter string.
//
// This is the whole trick that keeps the studio honest: the preview puts that
// string on the <video> element's `filter`, and the exporter hands the same
// string to compileFilter() in canvas-filter.ts, which reimplements those exact
// functions as a colour matrix. One source of truth, two consumers — there is
// no second code path where a slider could mean something different at bake
// time than it did on screen.
//
// Only the six functions canvas-filter.ts implements may appear here:
// brightness, contrast, saturate, grayscale, sepia, hue-rotate. Anything else
// would silently render in the preview and vanish from the export. Vignette is
// the deliberate exception — it is not expressible as a colour matrix at all, so
// it is drawn (render.ts) rather than filtered, in both places.
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import type { Adjustments } from "./types";
import { NEUTRAL_ADJUSTMENTS } from "./types";

export function filterCssFor(filterId: string): string {
  const preset = CAMERA_FILTERS.find((f) => f.id === filterId);
  return preset && preset.previewCss !== "none" ? preset.previewCss : "";
}

/** The Adjust sliders as CSS filter functions. Empty string when untouched. */
export function adjustmentsCss(a: Adjustments): string {
  const parts: string[] = [];

  // Brightness/contrast/saturation are direct, at half strength so the full
  // slider throw is a strong-but-usable look rather than a blown-out one.
  if (a.brightness !== 0) parts.push(`brightness(${(1 + a.brightness / 200).toFixed(4)})`);
  if (a.contrast !== 0) parts.push(`contrast(${(1 + a.contrast / 200).toFixed(4)})`);
  if (a.saturation !== 0) parts.push(`saturate(${(1 + a.saturation / 100).toFixed(4)})`);

  // Warmth has no CSS primitive. Positive leans amber via sepia + a saturation
  // nudge to stop it going flat; negative rotates hue toward blue.
  if (a.warmth > 0) {
    parts.push(`sepia(${(a.warmth / 320).toFixed(4)})`);
    parts.push(`saturate(${(1 + a.warmth / 400).toFixed(4)})`);
  } else if (a.warmth < 0) {
    parts.push(`hue-rotate(${(a.warmth / 8).toFixed(2)}deg)`);
    parts.push(`saturate(${(1 + -a.warmth / 500).toFixed(4)})`);
  }

  // Fade = the matte look: crush contrast and lift the whole image, which is
  // what a lifted-black curve does to a colour matrix.
  if (a.fade > 0) {
    parts.push(`contrast(${(1 - a.fade / 400).toFixed(4)})`);
    parts.push(`brightness(${(1 + a.fade / 900).toFixed(4)})`);
  }

  return parts.join(" ");
}

/** Preset first, then adjustments — the same order the panels are stacked in,
 *  so nudging Warmth tweaks the graded image rather than the raw one. */
export function combinedFilterCss(filterId: string, adjustments: Adjustments): string {
  const combined = [filterCssFor(filterId), adjustmentsCss(adjustments)].filter(Boolean).join(" ");
  return combined || "none";
}

export const ADJUSTMENT_CONTROLS: {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "warmth", label: "Warmth", min: -100, max: 100 },
  { key: "fade", label: "Fade", min: 0, max: 100 },
  { key: "vignette", label: "Vignette", min: 0, max: 100 },
];

export function resetAdjustments(): Adjustments {
  return { ...NEUTRAL_ADJUSTMENTS };
}
