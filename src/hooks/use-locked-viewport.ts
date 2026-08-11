import { useEffect } from "react";

// Toggles a body class that locks page scroll for as long as the calling
// route is mounted. Locking html/body position:fixed stops NORMAL page
// scroll, but iOS Safari's own "scroll focused input into view" behavior
// can still pan the window a few px on input focus even with that lock in
// place — the scroll listener below snaps it straight back to (0,0)
// whenever that happens, so it's visually imperceptible instead of
// revealing a strip of unstyled body background.
export function useLockedViewport() {
  useEffect(() => {
    document.body.classList.add("oak-locked-viewport");

    const snapBack = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", snapBack, { passive: true });

    return () => {
      document.body.classList.remove("oak-locked-viewport");
      window.removeEventListener("scroll", snapBack);
    };
  }, []);
}