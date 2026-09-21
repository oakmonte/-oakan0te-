import { useLayoutEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;
let savedStyle: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

function acquireLock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const { style } = document.body;
    savedStyle = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = "fixed";
    style.top = `-${savedScrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";
  }
  lockCount++;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && savedStyle) {
    const { style } = document.body;
    style.position = savedStyle.position;
    style.top = savedStyle.top;
    style.left = savedStyle.left;
    style.right = savedStyle.right;
    style.width = savedStyle.width;
    style.overflow = savedStyle.overflow;
    savedStyle = null;
    window.scrollTo(0, savedScrollY);
  }
}

// Pins <body> with position:fixed rather than just overflow:hidden --
// overflow:hidden alone doesn't reliably stop iOS Safari from scroll-chaining
// a touch drag that starts inside a fixed-position overlay (a bottom sheet,
// here) into the page behind it. position:fixed removes body from the
// scrollable flow entirely, so there's nothing left for that drag to scroll.
// Captures/restores scrollY around the lock, unlike .oak-locked-viewport
// (use-locked-viewport.ts), because the pages that use this hook are
// genuinely scrollable before the lock engages -- without it the page would
// visually jump to the top the instant the sheet opens.
// Ref-counted at module scope, same pattern as use-locked-viewport.ts, so
// nothing stops two lock consumers from nesting.
export function useBodyScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    acquireLock();
    return releaseLock;
  }, [active]);
}
