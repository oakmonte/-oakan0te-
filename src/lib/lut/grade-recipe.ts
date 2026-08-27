// A GradeRecipe is a small set of real color-grading controls — tone curve,
// white balance, split-toning, fade — the same vocabulary a colorist uses in
// DaVinci/Lightroom. generate-lut.ts bakes one into an actual 3D lookup table
// (the same technique/format the whole color-grading industry uses, .cube
// files included), which is what makes these "meaningful" filters rather than
// a CSS brightness/contrast/saturate chain: independent shadow/highlight
// tinting and tone-region curves are not expressible as a single 3x3 color
// matrix, however many CSS functions you chain.
export interface GradeRecipe {
  /** Additive lift/crush in the shadow region. -1..1 */
  shadows: number;
  /** Gamma-style lift in the midtone region. -1..1 */
  midtones: number;
  /** Additive lift/crush in the highlight region. -1..1 */
  highlights: number;
  /** S-curve strength pivoted at middle grey. -1..1 */
  contrast: number;
  /** Global saturation delta, applied luma-preserving. -1 (grayscale) .. 1 (vivid) */
  saturation: number;
  /** White balance: blue (-1) .. amber (1) */
  temperature: number;
  /** White balance: green (-1) .. magenta (1) */
  tint: number;
  /** Tint color mixed into shadows, RGB 0..1 */
  splitShadow: readonly [number, number, number];
  /** Tint color mixed into highlights, RGB 0..1 */
  splitHighlight: readonly [number, number, number];
  /** How strongly the split-tone colors are mixed in. 0..1 */
  splitStrength: number;
  /** Lifts black point for a matte/washed film look. 0..1 */
  fade: number;
}

export const NEUTRAL_RECIPE: GradeRecipe = {
  shadows: 0,
  midtones: 0,
  highlights: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  splitShadow: [0, 0, 0],
  splitHighlight: [0, 0, 0],
  splitStrength: 0,
  fade: 0,
};

/** Fills in any fields a preset omits with NEUTRAL_RECIPE's values, so each
 *  recipe below only has to state what it actually changes. */
export function recipe(partial: Partial<GradeRecipe>): GradeRecipe {
  return { ...NEUTRAL_RECIPE, ...partial };
}
