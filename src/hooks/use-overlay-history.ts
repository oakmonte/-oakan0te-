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
import { noteExternalPush, readIndex } from "@/lib/nav-stack";

export function useOverlayHistory(open: boolean, onClose: () => void) {
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

    let ours = true;
    const onPop = () => {
      ours = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by a tap-outside, a confirm, or an unmount rather than by the
      // gesture. Our entry is still on the stack, so take it back off —
      // otherwise the next back press would be swallowed doing nothing.
      if (ours) window.history.back();
    };
  }, [open]);
}
