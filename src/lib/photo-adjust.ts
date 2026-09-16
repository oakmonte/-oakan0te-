export type ExtendedPhotoAdjust = {
  exposure: number; // -100 to 100
  contrast: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  temperature: number; // -100 to 100
  vibrance: number; // -100 to 100
  vignette: number; // 0 to 100
};

export const EXTENDED_NEUTRAL_ADJUST: ExtendedPhotoAdjust = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  vibrance: 0,
  vignette: 0,
};

export const EXTENDED_ADJUST_CONTROLS: { key: keyof ExtendedPhotoAdjust; label: string }[] = [
  { key: "exposure", label: "Exposure" },
  { key: "contrast", label: "Contrast" },
  { key: "highlights", label: "Highlights" },
  { key: "shadows", label: "Shadows" },
  { key: "temperature", label: "Warmth" },
  { key: "vibrance", label: "Vibrance" },
  { key: "vignette", label: "Vignette" },
];

export function extendedAdjustToCss(adj: ExtendedPhotoAdjust): string {
  const filters: string[] = [];
  if (adj.exposure !== 0) filters.push(`brightness(${1 + adj.exposure / 100})`);
  if (adj.contrast !== 0) filters.push(`contrast(${1 + adj.contrast / 100})`);
  if (adj.temperature !== 0) {
    // Warmth simulation via sepia and hue-rotate
    filters.push(
      adj.temperature > 0
        ? `sepia(${adj.temperature / 200}) hue-rotate(-${adj.temperature / 10}deg)`
        : `hue-rotate(${Math.abs(adj.temperature) / 5}deg)`,
    );
  }
  if (adj.vibrance !== 0) filters.push(`saturate(${1 + adj.vibrance / 100})`);
  return filters.length ? filters.join(" ") : "none";
}
export type PhotoAdjust = ExtendedPhotoAdjust;
export const NEUTRAL_ADJUST: PhotoAdjust = EXTENDED_NEUTRAL_ADJUST;
export const ADJUST_CONTROLS: { key: keyof PhotoAdjust; label: string }[] =
  EXTENDED_ADJUST_CONTROLS;
export const adjustToCss = extendedAdjustToCss;
export function isNeutralAdjust(adj: PhotoAdjust): boolean {
  return (
    adj.exposure === 0 &&
    adj.contrast === 0 &&
    adj.highlights === 0 &&
    adj.shadows === 0 &&
    adj.temperature === 0 &&
    adj.vibrance === 0 &&
    adj.vignette === 0
  );
}
