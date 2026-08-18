import { useEffect, useState, type RefObject } from "react";

export type FittedSize = { width: number; height: number };

// Largest box of the given aspect ratio that fits entirely inside `containerRef`
// — "contain", computed in JS rather than CSS.
//
// CSS can't express this with one rule. `aspect-ratio` only back-solves the axis
// that is `auto`: with `width:100%` + `max-height:100%` the height gets clamped
// but the width stays at 100%, so the box silently takes on the CONTAINER's
// aspect instead of the media's — and since the media element inside uses
// object-cover, the frame is then centre-cropped without anything looking broken.
// That was real: a 400x1200 capture rendered in a 375x812 box (0.462 instead of
// 0.333), quietly cutting the top and bottom off the user's own shot and giving
// the crop tool a distorted mapping back to source pixels.
//
// Returning zeros before the first measurement is deliberate — callers render
// nothing rather than a wrong-shaped box for one frame.
export function useFittedSize(
  containerRef: RefObject<HTMLElement | null>,
  aspect: number,
): FittedSize {
  const [size, setSize] = useState<FittedSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !Number.isFinite(aspect) || aspect <= 0) return;

    const measure = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      // Fit to width unless that would overflow the height.
      let width = availW;
      let height = width / aspect;
      if (height > availH) {
        height = availH;
        width = height * aspect;
      }
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [containerRef, aspect]);

  return size;
}
