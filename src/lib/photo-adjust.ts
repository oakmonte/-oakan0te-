/** Manual tone controls for the photo editor — the "Adjust" tool.
 *
 *  Every control here compiles to a CSS filter function that
 *  `canvas-filter.ts#compileFilter` already understands (brightness, contrast,
 *  saturate, sepia, hue-rotate, grayscale). That is the whole point of the
 *  design: the same string drives the live preview as an element `filter`, and
 *  the export compiles it into the SAME single composite pass the grade and
 *  the layers go through. No second decode, no second encode, no
 *  `applyAdjustToBlob` — see the media-export-pipeline notes on why that
 *  matters.
 *
 *  Values are stored the way the slider reads them: 0 is neutral, ±100 is the
 *  extreme. Converting to CSS is the only place the actual multipliers live. */
export type PhotoAdjust = {
  brightness: number;
  contrast: number;
  saturation: number;
  /** Toward warm (sepia) at positive values, toward cool (hue-rotate) at
   *  negative ones. Two different functions because CSS has no single
   *  temperature primitive and these are the two compileFilter supports that
   *  read as warm/cool to the eye. */
  warmth: number;
  fade: number;
};

export const NEUTRAL_ADJUST: PhotoAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
};

export const ADJUST_CONTROLS: { key: keyof PhotoAdjust; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "warmth", label: "Warmth" },
  { key: "fade", label: "Fade" },
];

export function isNeutralAdjust(a: PhotoAdjust): boolean {
  return ADJUST_CONTROLS.every(({ key }) => a[key] === 0);
}

/** The CSS filter string for these adjustments, or "" when nothing is set.
 *
 *  Ranges are deliberately conservative — a slider that can destroy the frame
 *  at 100% is a slider people stop trusting. Brightness and contrast move ±40%,
 *  saturation ±80%, and fade only ever removes saturation (it never adds). */
export function adjustToCss(a: PhotoAdjust): string {
  if (isNeutralAdjust(a)) return "";
  const parts: string[] = [];
  if (a.brightness !== 0) parts.push(`brightness(${(1 + a.brightness / 250).toFixed(4)})`);
  if (a.contrast !== 0) parts.push(`contrast(${(1 + a.contrast / 250).toFixed(4)})`);
  if (a.saturation !== 0) parts.push(`saturate(${(1 + a.saturation / 125).toFixed(4)})`);
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 300).toFixed(4)})`);
  if (a.warmth < 0) parts.push(`hue-rotate(${(a.warmth / 8).toFixed(2)}deg)`);
  if (a.fade !== 0) parts.push(`saturate(${(1 - Math.abs(a.fade) / 200).toFixed(4)})`);
  return parts.join(" ");
}
