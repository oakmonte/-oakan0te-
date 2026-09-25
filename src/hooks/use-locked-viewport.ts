import { useLayoutEffect } from "react";

// Toggles a body class that locks page scroll for as long as the calling
// component is mounted, and opts this route's viewport into
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
//
// Used far more widely than "a route" now suggests: every product-form sheet
// with a text input calls this too (per this project's product-form
// conventions), and those are modals opened from partway down a genuinely
// long, scrollable product-form page -- not routes with their own
// already-fixed layout the way the camera/after-shot screens are. That
// mismatch is exactly what the scrollY save/restore below is for; see
// styles.css's .oak-locked-viewport for the other half of the fix (an
// unresolved percentage height on a locked body, which is what actually
// produced a sheet's header landing far down the page with dead space above
// it, not just a scroll-position jump).

// Module-level, ref-counted rather than "capture original on mount, restore
// on unmount" — two sheets that both call this hook (nothing stops that;
// several product-form sheets can be open at once) used to each capture their
// own snapshot of the meta tag and stomp each other's restore on teardown if
// they didn't unmount in the same order they mounted. A shared counter makes
// the DOM only ever get touched on the 0->1 and 1->0 edges, so nesting order
// stops mattering.
let lockCount = 0;
let originalMetaContent: string | null = null;
// Where the page was scrolled to right before locking it. `.oak-locked-
// viewport` switches body to `position: fixed`, and a fixed box with no
// `top` set falls back to its own STATIC position -- for `<body>` that's
// always document y=0, regardless of how far the page was scrolled. Without
// this, opening any sheet on a page scrolled even a little snapped body back
// to its very top for as long as the sheet was open (invisible behind it,
// since the sheet itself covers the screen) and then left it there, or in
// some browsers reset to 0, once the sheet closed -- "the page I was on
// jumped/reset the moment I opened or closed this". `top: -scrollY` keeps
// body visually exactly where it already was the instant it goes fixed, and
// the restore below un-does that same offset when it comes back.
let savedScrollY = 0;

function acquireLock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    document.body.style.top = `-${savedScrollY}px`;
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
    document.body.style.top = "";
    window.scrollTo(0, savedScrollY);
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
