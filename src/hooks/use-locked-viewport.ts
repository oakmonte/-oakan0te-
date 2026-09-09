import { useLayoutEffect } from "react";

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

// Module-level, ref-counted rather than "capture original on mount, restore
// on unmount" — two sheets that both call this hook (nothing stops that;
// several product-form sheets can be open at once) used to each capture their
// own snapshot of the meta tag and stomp each other's restore on teardown if
// they didn't unmount in the same order they mounted. A shared counter makes
// the DOM only ever get touched on the 0->1 and 1->0 edges, so nesting order
// stops mattering.
let lockCount = 0;
let originalMetaContent: string | null = null;

function acquireLock() {
  if (lockCount === 0) {
    document.body.classList.add("oak-locked-viewport");
    const meta = document.querySelector('meta[name="viewport"]');
    originalMetaContent = meta?.getAttribute("content") ?? null;
    if (meta && originalMetaContent && !originalMetaContent.includes("interactive-widget")) {
      meta.setAttribute("content", `${originalMetaContent}, interactive-widget=overlays-content`);
    }
  }
  lockCount++;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove("oak-locked-viewport");
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && originalMetaContent !== null) meta.setAttribute("content", originalMetaContent);
    originalMetaContent = null;
  }
}

export function useLockedViewport() {
  // useLayoutEffect, not useEffect: an autofocused input in a brand-new sheet
  // (e.g. OptionEditorSheet's name field) focuses during React's commit,
  // before any useEffect runs — on iOS that's early enough to trigger the
  // keyboard under the OLD viewport contract if this hook hasn't rewritten
  // the meta tag yet, which is exactly what let the keyboard push the sheet
  // up instead of overlaying it. useLayoutEffect runs synchronously as part
  // of the same commit, closing that race.
  useLayoutEffect(() => {
    acquireLock();
    return releaseLock;
  }, []);
}
