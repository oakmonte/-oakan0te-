// Whether a full-bleed black overlay is covering a light screen right now.
//
// /home follows the phone's light/dark setting, but its Explore feed is a
// black, full-screen video overlay on the SAME route — so the pathname alone
// (what surface.ts decides from) cannot tell RootShell to paint the status
// strip and scroll edge black while it's up. The overlay flips this instead,
// and RootShell reads it.
//
// Module-level with a subscribe/get pair, for useSyncExternalStore: it has to
// be readable from the root shell without a provider threaded through every
// route, the same reason nav-stack.ts and capture-handoff.ts are modules.
import { useEffect, useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = () => count > 0;
// Nothing is ever open during SSR.
const getServerSnapshot = () => false;

export function useDarkOverlayActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Mark a black overlay as covering the page for as long as `active` holds.
 *  Ref-counted, so two overlays unmounting out of order can't strand it. */
export function useDarkOverlay(active: boolean) {
  useEffect(() => {
    if (!active) return;
    count++;
    emit();
    return () => {
      count = Math.max(0, count - 1);
      emit();
    };
  }, [active]);
}
