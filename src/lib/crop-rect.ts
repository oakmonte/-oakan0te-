// A crop, expressed the same way layer positions already are (see
// after-shot-layers.ts's BaseLayer.x/y comment): a fraction 0..1 of the
// ORIGINAL, untouched media's natural width/height. Resolution-independent,
// and — unlike a pixel rect — stays meaningful across re-crops without
// needing the media itself to have been re-encoded in between.
export type CropRect = { x: number; y: number; w: number; h: number };

const EPSILON = 0.001;

/** True for `null` or for a rect that covers (close enough to) the whole
 *  frame — both mean "no crop," and callers use this to skip the crop pass
 *  entirely rather than pay for a no-op one. */
export function isCropNoop(rect: CropRect | null): boolean {
  if (!rect) return true;
  return rect.x <= EPSILON && rect.y <= EPSILON && rect.w >= 1 - EPSILON && rect.h >= 1 - EPSILON;
}

/** Re-cropping crops the CURRENTLY DISPLAYED (already-cropped) frame, so a
 *  second crop's rect — itself a fraction of that already-cropped view — has
 *  to be composed with the first to get one fraction of the true original.
 *  `inner` is relative to `outer`'s frame; `outer` is `null` for "no crop
 *  yet," equivalent to the full {0,0,1,1} frame. */
export function composeCropRect(outer: CropRect | null, inner: CropRect): CropRect {
  const base = outer ?? { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: base.x + inner.x * base.w,
    y: base.y + inner.y * base.h,
    w: inner.w * base.w,
    h: inner.h * base.h,
  };
}
