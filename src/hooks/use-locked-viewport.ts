import { useEffect, type RefObject } from "react";

// iOS Safari doesn't support interactive-widget (Chrome/Firefox only —
// see github.com/WebKit/standards-positions/issues/65), so when the
// keyboard opens, Safari's own "scroll focused input into view" behavior
// pans the whole layout viewport regardless of position:fixed. There's no
// CSS fix for this on Safari today — so instead of fighting it with CSS,
// this manually re-pins the container's real height + vertical offset to
// window.visualViewport on every resize/scroll tick, which is what makes
// the page actually stay put while the keyboard overlays on top of it.
export function useLockedViewport(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    document.body.classList.add("oak-locked-viewport");
    const vv = window.visualViewport;
    const el = containerRef.current;

    const pin = () => {
      if (!vv || !el) return;
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };

    pin();
    vv?.addEventListener("resize", pin);
    vv?.addEventListener("scroll", pin);

    return () => {
      document.body.classList.remove("oak-locked-viewport");
      vv?.removeEventListener("resize", pin);
      vv?.removeEventListener("scroll", pin);
      if (el) {
        el.style.height = "";
        el.style.transform = "";
      }
    };
  }, [containerRef]);
}