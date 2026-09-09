import { useRef } from "react";

/** Distinguishes a long-press from a tap or a scroll -- the same
 *  timer-plus-slop-threshold pattern already proven in
 *  `ImageGallery.tsx`'s `ThumbStrip` (long-press-to-reorder), extracted here
 *  since a third independent hand-rolled copy of it (on the products/
 *  collections lists) is one too many.
 *
 *  Owns the element's entire `onClick` rather than leaving it to the
 *  caller: the browser still fires a plain click after the pointerup that
 *  follows a long-press, and a caller-supplied `onClick` set alongside this
 *  hook's handlers would fire right after `onLongPress` and immediately
 *  undo whatever it just did (e.g. toggling a row back out of a selection
 *  it was just added to). Pass the tap behavior in as `onTap` instead of
 *  wiring your own `onClick` -- that's what keeps this swallow-the-
 *  trailing-click behavior from being something every call site has to
 *  remember to do correctly on its own. */
export function useLongPress(
  onLongPress: () => void,
  { delay = 300, slop = 8, onTap }: { delay?: number; slop?: number; onTap?: () => void } = {},
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
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // The target can be gone by the time this timer fires (e.g. the
        // list re-rendered mid-hold) -- an uncaught exception here would
        // abandon the gesture without ever calling onLongPress below.
      }
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

  function onClick(e: React.MouseEvent) {
    if (fired.current) {
      // This click is the trailing one from the long-press gesture that
      // just fired onLongPress -- swallow it so it can't also act as a tap,
      // then reset so the NEXT genuine tap isn't eaten too.
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onTap?.();
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick };
}
