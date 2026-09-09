import { useRef } from "react";

/** Distinguishes a long-press from a tap or a scroll -- the same
 *  timer-plus-slop-threshold pattern already proven in
 *  `ImageGallery.tsx`'s `ThumbStrip` (long-press-to-reorder), extracted here
 *  since a third independent hand-rolled copy of it (on the products/
 *  collections lists) is one too many. Purely additive: spread the returned
 *  handlers onto anything that also has its own `onClick` -- a plain tap
 *  never fires `onLongPress` and falls through to that `onClick` normally,
 *  since nothing here calls preventDefault/stopPropagation. */
export function useLongPress(
  onLongPress: () => void,
  { delay = 300, slop = 8 }: { delay?: number; slop?: number } = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    const pointerId = e.pointerId;
    const target = e.currentTarget as HTMLElement;
    clearTimer();
    timer.current = setTimeout(() => {
      fired.current = true;
      target.setPointerCapture(pointerId);
      onLongPress();
    }, delay);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || fired.current) return;
    const dx = Math.abs(e.clientX - start.current.x);
    const dy = Math.abs(e.clientY - start.current.y);
    // A real scroll/drag cancels the pending hold -- same slop threshold as
    // ThumbStrip, distinguishing "finger is scrolling" from "finger is still".
    if (dx > slop || dy > slop) clearTimer();
  }

  function onPointerUp() {
    clearTimer();
    start.current = null;
  }

  function onPointerCancel() {
    clearTimer();
    start.current = null;
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
