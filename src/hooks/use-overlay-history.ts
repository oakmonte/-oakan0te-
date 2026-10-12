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
import {
  noteExternalPush,
  readIndex,
  shouldCloseOnPop,
  shouldRemoveOverlayEntry,
} from "@/lib/nav-stack";

// Closing an overlay by a button takes its entry off with a history step that
// lands asynchronously. If another overlay opens in the same render (a menu
// item opening a confirm, a sheet replacing another) and pushes before that
// step lands, the two race -- and browsers disagree on the result: Chrome steps
// back from the new entry, iOS Safari from the old one, which pops one entry
// too many and sends the next close out of the page entirely. So an overlay
// opening while a step is pending waits for it to land, then pushes. Order in
// history is then always open -> close -> open, on every browser.
//
// Steps from overlays closing in the same render are summed into one go(-n):
// separate back() calls in one tick aren't reliably all honoured.
let batchedBacks = 0;
let settling: Promise<void> | null = null;

function queueSelfBack() {
  if (batchedBacks++ > 0) return;
  settling = new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("popstate", done, true);
      clearTimeout(timer);
      // After the whole popstate dispatch, so the router has handled the
      // landed entry before anyone pushes over it.
      setTimeout(() => {
        settling = null;
        resolve();
      }, 0);
    };
    window.addEventListener("popstate", done, true);
    // A step that never lands must not hold every future overlay hostage.
    const timer = setTimeout(done, 1000);
  });
  queueMicrotask(() => {
    const steps = batchedBacks;
    batchedBacks = 0;
    window.history.go(-steps);
  });
}

export function useOverlayHistory(open: boolean, onClose: () => void) {
  const router = useRouter();

  // Held in a ref so the effect does not re-run — and re-push — every time the
  // caller passes a fresh closure, which inline arrow props do on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const setup = () => {
      const openedIndex = readIndex(window.history.state) + 1;
      const state = {
        ...(window.history.state ?? {}),
        __TSR_index: openedIndex,
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
      const onPop = (event: PopStateEvent) => {
        // A pop that only took a sheet stacked above us off is not ours.
        if (!shouldCloseOnPop(openedIndex, readIndex(event.state))) return;
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
        if (remove) queueSelfBack();
      };
    };

    if (!settling) return setup();
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void settling.then(() => {
      if (!cancelled) teardown = setup();
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [open, router]);
}
