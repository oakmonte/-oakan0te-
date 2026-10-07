// Snapping for chips dragged along the timeline.
//
// Lining a caption up with a cut, or a sound effect with the playhead, by eye
// on a phone is a matter of luck: a thumb is ~40px wide and at default zoom
// that's half a second. Within a few pixels of something worth lining up
// with, the edge jumps onto it and a guide line says so.

/** Pixels within which an edge snaps. Converted to seconds by the caller,
 *  since how far that is in time depends on zoom. */
export const SNAP_PX = 8;

/** The nearest target within `threshold` seconds of `t`, or `t` itself. */
export function snapTime(
  t: number,
  targets: readonly number[],
  threshold: number,
): { time: number; target: number | null } {
  let best: number | null = null;
  let bestDistance = threshold;
  for (const target of targets) {
    const distance = Math.abs(target - t);
    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best === null ? { time: t, target: null } : { time: best, target: best };
}

/** Move a whole span, snapping whichever of its two edges lands closer to a
 *  target. The span keeps its length. */
export function snapSpan(
  start: number,
  length: number,
  targets: readonly number[],
  threshold: number,
): { start: number; target: number | null } {
  const head = snapTime(start, targets, threshold);
  const tail = snapTime(start + length, targets, threshold);
  const headDistance = head.target === null ? Infinity : Math.abs(head.time - start);
  const tailDistance = tail.target === null ? Infinity : Math.abs(tail.time - (start + length));
  if (headDistance === Infinity && tailDistance === Infinity) return { start, target: null };
  return headDistance <= tailDistance
    ? { start: head.time, target: head.target }
    : { start: tail.time - length, target: tail.target };
}
