import type { GradeRecipe } from "./grade-recipe";

// 17x17x17 is the standard grid size the color-grading industry ships .cube
// files at (Adobe/DaVinci/etc.) — enough points that trilinear interpolation
// between them is visually smooth, small enough that generating and storing
// the table costs nothing worth measuring.
export const LUT_SIZE = 17;

export interface LutTable {
  size: number;
  /** Flattened size^3 * 3 table, one RGB triple (0..1 floats) per grid point,
   *  indexed as ((ir * size + ig) * size + ib) * 3. */
  data: Float32Array;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Applies one recipe to a single 0..1 RGB triple. Shared by the table
 *  generator (baking a grid point) and anything that wants the exact grade
 *  math without going through a table (there is currently no such caller,
 *  but keeping this pure and separate from the grid loop is what makes it
 *  testable/tunable in isolation). */
export function gradePixel(
  recipe: GradeRecipe,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  // 1. Tone curve: blend three additive region adjustments by how much this
  // pixel's luma sits in the shadow/mid/highlight range, then an S-curve for
  // contrast pivoted at middle grey.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const shadowWeight = 1 - smoothstep(0, 0.55, luma);
  const highlightWeight = smoothstep(0.45, 1, luma);
  const midWeight = 1 - shadowWeight - highlightWeight + shadowWeight * highlightWeight;

  let rr = r + recipe.shadows * 0.35 * shadowWeight;
  let gg = g + recipe.shadows * 0.35 * shadowWeight;
  let bb = b + recipe.shadows * 0.35 * shadowWeight;

  rr += recipe.midtones * 0.3 * midWeight;
  gg += recipe.midtones * 0.3 * midWeight;
  bb += recipe.midtones * 0.3 * midWeight;

  rr += recipe.highlights * 0.35 * highlightWeight;
  gg += recipe.highlights * 0.35 * highlightWeight;
  bb += recipe.highlights * 0.35 * highlightWeight;

  if (recipe.contrast !== 0) {
    const k = recipe.contrast * 0.6;
    rr = rr + (rr - 0.5) * k;
    gg = gg + (gg - 0.5) * k;
    bb = bb + (bb - 0.5) * k;
  }

  // 2. White balance: temperature scales red up / blue down (or the reverse);
  // tint scales green against red+blue.
  if (recipe.temperature !== 0) {
    rr += recipe.temperature * 0.12;
    bb -= recipe.temperature * 0.12;
  }
  if (recipe.tint !== 0) {
    gg += recipe.tint * 0.1;
    rr -= recipe.tint * 0.05;
    bb -= recipe.tint * 0.05;
  }

  // 3. Saturation, luma-preserving (mix each channel toward/away from its
  // own luma rather than a flat multiply, so the curve/WB work above isn't
  // undone).
  if (recipe.saturation !== 0) {
    const l = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    const s = 1 + recipe.saturation;
    rr = l + (rr - l) * s;
    gg = l + (gg - l) * s;
    bb = l + (bb - l) * s;
  }

  // 4. Split-toning: mix the shadow tint into dark pixels and the highlight
  // tint into bright ones. This is the move a 3x3 color matrix structurally
  // cannot do — a matrix applies the same transform to every pixel regardless
  // of tone, so shadows and highlights can never be pushed toward different
  // colors independently.
  if (recipe.splitStrength > 0) {
    const l2 = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    const shadowMix = (1 - smoothstep(0, 0.6, l2)) * recipe.splitStrength;
    const highlightMix = smoothstep(0.4, 1, l2) * recipe.splitStrength;
    rr =
      rr +
      (recipe.splitShadow[0] - 0.5) * shadowMix +
      (recipe.splitHighlight[0] - 0.5) * highlightMix;
    gg =
      gg +
      (recipe.splitShadow[1] - 0.5) * shadowMix +
      (recipe.splitHighlight[1] - 0.5) * highlightMix;
    bb =
      bb +
      (recipe.splitShadow[2] - 0.5) * shadowMix +
      (recipe.splitHighlight[2] - 0.5) * highlightMix;
  }

  // 5. Fade: lift the black point and gently compress toward it — the washed,
  // can't-quite-reach-black look of cross-processed or expired film.
  if (recipe.fade > 0) {
    const lift = recipe.fade * 0.1;
    rr = lift + rr * (1 - lift);
    gg = lift + gg * (1 - lift);
    bb = lift + bb * (1 - lift);
  }

  return [clamp01(rr), clamp01(gg), clamp01(bb)];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Bakes a recipe into a 3D LUT table by evaluating gradePixel at every grid
 *  point. 17^3 = 4913 evaluations — sub-millisecond, and callers memoize the
 *  result per filter id so it only ever runs once. */
export function generateLut(recipe: GradeRecipe, size: number = LUT_SIZE): LutTable {
  const data = new Float32Array(size * size * size * 3);
  const step = 1 / (size - 1);
  let i = 0;
  for (let ir = 0; ir < size; ir++) {
    const r = ir * step;
    for (let ig = 0; ig < size; ig++) {
      const g = ig * step;
      for (let ib = 0; ib < size; ib++) {
        const b = ib * step;
        const [rr, gg, bb] = gradePixel(recipe, r, g, b);
        data[i++] = rr;
        data[i++] = gg;
        data[i++] = bb;
      }
    }
  }
  return { size, data };
}
