// What a swipe in from the left edge should do, and whether it has gone far
// enough to do it. Pure, so the decisions can be tested without a DOM — the
// gesture and animation live in EdgeSwipeBack.tsx.
//
// Only the installed iOS app gets this gesture. Safari tabs already have the
// system edge swipe and Android has its system back gesture — both walk
// history, which use-back.ts keeps shaped like the app's hierarchy — so a
// second, home-made one there would fire alongside the real one and go back
// twice. A standalone iOS web app has no back gesture at all; this fills that
// gap and nothing else.

import { isUnmanaged } from "@/lib/nav-hierarchy";

/** Touches starting within this many px of the left edge can become a swipe. */
export const EDGE_ZONE_PX = 24;
/** Horizontal travel before the gesture is claimed from the page. */
export const CLAIM_PX = 8;

export type SwipeAction =
  /** A sheet or drawer has its own history entry: pop it, which closes it. */
  | "close-overlay"
  /** The screen's own back button is mounted: do exactly what it does, so
   *  its `to` override and `onIntercept` confirm (the studio's unsaved-edit
   *  prompt) apply to the swipe as well. */
  | "screen-back"
  /** Up the app hierarchy, the way a back chevron would (useBack). */
  | "up"
  /** A screen the hierarchy deliberately doesn't manage: plain history back. */
  | "history"
  /** A root: nothing above it. The page gives a little and springs back. */
  | "none";

/** Trees where a left-edge drag belongs to the screen. The camera and editors
 *  are full-bleed canvases (drawing, crop handles, the filter strip) and
 *  manage their own returns — see UNMANAGED_PREFIXES in nav-hierarchy.ts. */
export function edgeSwipeBlocked(pathname: string): boolean {
  return pathname === "/create" || pathname.startsWith("/create/");
}

export function resolveSwipeAction(args: {
  pathname: string;
  overlayOpen: boolean;
  hasScreenBack: boolean;
  hasHierarchyParent: boolean;
  stackIndex: number;
}): SwipeAction {
  if (args.overlayOpen) return "close-overlay";
  if (args.hasScreenBack) return "screen-back";
  if (args.hasHierarchyParent) return "up";
  if (isUnmanaged(args.pathname) && args.stackIndex > 0) return "history";
  return "none";
}

/** Past a third of the screen, or flicked. A flick back towards the edge
 *  cancels however far the page had travelled — that is how native reads it. */
export function shouldCommit(dx: number, velocityPxPerMs: number, width: number): boolean {
  if (velocityPxPerMs < -0.2) return false;
  if (dx > width * 0.33) return true;
  return velocityPxPerMs > 0.35 && dx > 30;
}

/** Travel at a root: follows the finger at first, then stiffens towards a cap,
 *  so it reads as "there is nothing behind this" rather than as broken. */
export function rubberBand(dx: number, cap = 56): number {
  if (dx <= 0) return 0;
  return cap * (1 - 1 / (dx / (cap * 2) + 1));
}
