import { useEffect } from "react";

// Toggles a body class that locks page scroll for as long as the calling
// route is mounted — a safety net alongside the interactive-widget
// meta tag (set globally in __root.tsx, reasserted locally in TextPanel)
// which is what actually stops the keyboard from dragging the layout.
// This hook does NOT touch element height/transform — that was the
// regression that broke the aspect-ratio box on the after-shot page.
export function useLockedViewport() {
  useEffect(() => {
    document.body.classList.add("oak-locked-viewport");
    return () => {
      document.body.classList.remove("oak-locked-viewport");
    };
  }, []);
}
