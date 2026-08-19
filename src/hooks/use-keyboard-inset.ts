import { useEffect, useState } from "react";

// How many pixels of the layout viewport the on-screen keyboard is covering.
//
// useLockedViewport() (plus the interactive-widget meta tag) stops the keyboard
// from pushing the page up, which is what keeps the media box from jumping — but
// it also means a control sitting at the bottom of the screen ends up UNDER the
// keyboard rather than above it. visualViewport is the only thing that reports
// where the keyboard actually is, so anything that must stay reachable while
// typing offsets itself by this.
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const measure = () => {
      // offsetTop covers the case where the browser scrolls the visual viewport
      // instead of shrinking it.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 40 ? covered : 0);
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, [active]);

  return inset;
}
