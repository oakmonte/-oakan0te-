import { useEffect } from "react";

// Toggles a body class that locks page scroll for as long as the calling
// route is mounted, and opts this route's viewport into
// interactive-widget=overlays-content — the two together are what stop the
// on-screen keyboard from dragging a fixed, full-screen layout (and the media
// box inside it) upward. overlays-content is NOT the app's default anymore
// (see __root.tsx) — every other route wants the keyboard to push/resize the
// page like a normal website, which is what a focused input needs to stay
// visible without this hook's own compensation. This hook is that
// compensation, scoped to the routes that actually need it.
//
// This hook does NOT touch element height/transform — that was the
// regression that broke the aspect-ratio box on the after-shot page.
export function useLockedViewport() {
  useEffect(() => {
    document.body.classList.add("oak-locked-viewport");

    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content") ?? null;
    if (meta && original && !original.includes("interactive-widget")) {
      meta.setAttribute("content", `${original}, interactive-widget=overlays-content`);
    }

    return () => {
      document.body.classList.remove("oak-locked-viewport");
      if (meta && original !== null) meta.setAttribute("content", original);
    };
  }, []);
}
