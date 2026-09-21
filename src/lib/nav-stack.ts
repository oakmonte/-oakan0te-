// A mirror of the browser history stack, so back navigation can pop to an
// ancestor instead of pushing a new entry on top of it.
//
// We do NOT invent our own index: @tanstack/history already stamps every entry
// with `__TSR_index` in history.state (see ParsedHistoryState in
// node_modules/@tanstack/history/dist/esm/index.d.ts). Reusing it means we
// cannot drift from the router's own idea of position and cannot collide with
// scroll restoration, which shares that state object.
//
// Module-level rather than React state, for the same reason as
// last-visited-route.ts: it has to survive navigation and must be readable
// from a click handler without a provider.
import type { RouterHistory } from "@tanstack/history";

type Entry = { pathname: string };

/** Sparse on purpose — indexes we have never seen stay undefined rather than
 *  being guessed at. A reload or BFCache restore lands us at a non-zero
 *  __TSR_index with nothing below it known; findAncestor then simply misses
 *  and the caller falls back to hierarchy navigation. */
let entries: Array<Entry | undefined> = [];
let currentIdx = 0;

export function readIndex(state: unknown): number {
  const idx = (state as { __TSR_index?: number } | null)?.__TSR_index;
  return typeof idx === "number" && idx >= 0 ? idx : 0;
}

export function currentIndex(): number {
  return currentIdx;
}

/** How far back the ancestor at `pathname` sits, or -1 if it is not behind us.
 *  Searches backwards so the NEAREST occurrence wins — which is what makes
 *  /edit-profile work: it has two possible parents, and the right one is
 *  whichever is actually below us. */
export function findAncestor(pathname: string): number {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (entries[i]?.pathname === pathname) return i;
  }
  return -1;
}

export function reset() {
  entries = [];
  currentIdx = 0;
}

/** Subscribe the mirror to the router's history. Returns an unsubscribe. */
export function attachNavStack(history: RouterHistory): () => void {
  const record = () => {
    const idx = readIndex(history.location.state);
    currentIdx = idx;
    entries[idx] = { pathname: history.location.pathname };
  };

  record();

  return history.subscribe(({ action }) => {
    const idx = readIndex(history.location.state);

    // A push invalidates everything above it — the forward entries are gone
    // from the browser's stack too, and leaving them here would let
    // findAncestor match a screen the user can no longer reach.
    if (action.type === "PUSH" && idx < entries.length) {
      entries.length = idx;
    }

    currentIdx = idx;
    entries[idx] = { pathname: history.location.pathname };
  });
}

/** Record a history entry pushed outside the router — overlays push one so the
 *  back gesture can close them, without changing the URL or re-running route
 *  matching (an open sheet is view state, not a route). The caller is
 *  responsible for stamping __TSR_index; see use-overlay-history.ts. */
export function noteExternalPush(pathname: string) {
  currentIdx += 1;
  entries.length = currentIdx;
  entries[currentIdx] = { pathname };
}

/** Test seam. Not used by app code. */
export function __setStateForTest(next: Array<Entry | undefined>, index: number) {
  entries = next;
  currentIdx = index;
}
