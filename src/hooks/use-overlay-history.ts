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
import { noteExternalPush, readIndex, shouldRemoveOverlayEntry } from "@/lib/nav-stack";

export function useOverlayHistory(open: boolean, onClose: () => void) {
  // Held in a ref so the effect does not re-run — and re-push — every time the
  // caller passes a fresh closure, which inline arrow props do on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const ourIndex = readIndex(window.history.state) + 1;
    const state = {
      ...(window.history.state ?? {}),
      __TSR_index: ourIndex,
      __oakOverlay: true,
    };
    window.history.pushState(state, "");
    noteExternalPush(window.location.pathname);

    let poppedByGesture = false;
    const onPop = () => {
      poppedByGesture = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);

      // See shouldRemoveOverlayEntry for why this is a condition and not just
      // history.back(). The short version: if the overlay is closing because a
      // menu row navigated somewhere, our entry is buried rather than on top,
      // and popping would undo that navigation.
      //
      // A buried entry is harmless — it carries the same pathname as the page
      // that opened it, so backing onto it renders that page with the overlay
      // shut, which is where back should land anyway.
      const remove = shouldRemoveOverlayEntry({
        poppedByGesture,
        ourIndex,
        currentIndex: readIndex(window.history.state),
      });
      if (remove) window.history.back();
    };
  }, [open]);
}
