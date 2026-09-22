// Give an overlay its own history entry, so the back gesture closes it instead
// of leaving the page underneath it.
//
// This generalises what messages.tsx had been doing alone for its thread view.
// Every other sheet in the app — the Explore feed, the post viewer, the profile
// and store drawers — was invisible to history, so swiping back with one open
// skipped straight past it and exited the screen.
//
// The entry is pushed with a raw pushState rather than through the router: an
// open sheet is view state, not a route, and we do not want the URL to change
// or route matching to re-run. @tanstack/history reads __TSR_index off
// history.state on every call rather than keeping its own counter (see
// node_modules/@tanstack/history/dist/esm/index.js:54), so stamping the next
// index ourselves keeps it and the stack mirror consistent.
import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { noteExternalPush, readIndex, shouldRemoveOverlayEntry } from "@/lib/nav-stack";

export function useOverlayHistory(open: boolean, onClose: () => void) {
  const router = useRouter();

  // Held in a ref so the effect does not re-run — and re-push — every time the
  // caller passes a fresh closure, which inline arrow props do on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const state = {
      ...(window.history.state ?? {}),
      __TSR_index: readIndex(window.history.state) + 1,
      __oakOverlay: true,
    };
    window.history.pushState(state, "");
    noteExternalPush(window.location.pathname);

    // The router's own href, read AFTER our sentinel goes on — the sentinel
    // deliberately does not change the URL, so this is still the page's href.
    // At cleanup we compare against this to tell "dismissed in place" from
    // "closed because we navigated". It must come from router.history and not
    // from window: @tanstack/history defers the real pushState to a microtask,
    // so window.history is still reporting the old entry while the router has
    // already committed the new one. See shouldRemoveOverlayEntry.
    const hrefAtOpen = router.history.location.href;

    let poppedByGesture = false;
    const onPop = () => {
      poppedByGesture = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);

      // A buried entry is harmless — it carries the same pathname as the page
      // that opened it, so backing onto it renders that page with the overlay
      // shut, which is where back should land anyway.
      const remove = shouldRemoveOverlayEntry({
        poppedByGesture,
        hrefAtOpen,
        hrefNow: router.history.location.href,
      });
      if (remove) window.history.back();
    };
  }, [open, router]);
}
