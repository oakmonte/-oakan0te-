import type { LutTable } from "./generate-lut";

/** Trilinearly samples `table` at a single 0..255 RGB and writes the result
 *  into `out` at `outOffset`. Hot path — no allocations, everything a local. */
function sampleInto(
  table: LutTable,
  r: number,
  g: number,
  b: number,
  out: Uint8ClampedArray,
  outOffset: number,
): void {
  const n = table.size;
  const data = table.data;
  const scale = n - 1;

  const fr = (r / 255) * scale;
  const fg = (g / 255) * scale;
  const fb = (b / 255) * scale;

  const ir0 = fr | 0;
  const ig0 = fg | 0;
  const ib0 = fb | 0;
  const ir1 = ir0 < scale ? ir0 + 1 : ir0;
  const ig1 = ig0 < scale ? ig0 + 1 : ig0;
  const ib1 = ib0 < scale ? ib0 + 1 : ib0;

  const tr = fr - ir0;
  const tg = fg - ig0;
  const tb = fb - ib0;

  const n2 = n * n;
  // The 8 corners of the cell this pixel falls in.
  const i000 = (ir0 * n2 + ig0 * n + ib0) * 3;
  const i001 = (ir0 * n2 + ig0 * n + ib1) * 3;
  const i010 = (ir0 * n2 + ig1 * n + ib0) * 3;
  const i011 = (ir0 * n2 + ig1 * n + ib1) * 3;
  const i100 = (ir1 * n2 + ig0 * n + ib0) * 3;
  const i101 = (ir1 * n2 + ig0 * n + ib1) * 3;
  const i110 = (ir1 * n2 + ig1 * n + ib0) * 3;
  const i111 = (ir1 * n2 + ig1 * n + ib1) * 3;

  for (let c = 0; c < 3; c++) {
    const c00 = data[i000 + c] * (1 - tb) + data[i001 + c] * tb;
    const c01 = data[i010 + c] * (1 - tb) + data[i011 + c] * tb;
    const c10 = data[i100 + c] * (1 - tb) + data[i101 + c] * tb;
    const c11 = data[i110 + c] * (1 - tb) + data[i111 + c] * tb;
    const c0 = c00 * (1 - tg) + c01 * tg;
    const c1 = c10 * (1 - tg) + c11 * tg;
    out[outOffset + c] = (c0 * (1 - tr) + c1 * tr) * 255;
  }
}

/** Applies a 3D LUT to ImageData in place via trilinear interpolation. Same
 *  contract as canvas-filter.ts's applyCompiledFilter: alpha untouched, meant
 *  for a getImageData/putImageData round trip since ctx.filter is unreliable
 *  on iOS Safari. This is a one-shot (photo capture, export bake) operation —
 *  see canvas-filter.ts's FilterOp union for why the live camera/recording
 *  preview paths deliberately do NOT route through here. */
export function applyLutToImageData(imageData: ImageData, table: LutTable): void {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    sampleInto(table, data[i], data[i + 1], data[i + 2], data, i);
  }
}
