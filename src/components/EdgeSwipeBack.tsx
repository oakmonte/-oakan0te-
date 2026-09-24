// Swipe in from the left edge to go back — in the installed iOS app only, which
// is the one place there is no system gesture for it. Why only there, and what
// the swipe decides to do, is in src/lib/edge-swipe.ts.
//
// The page follows the finger, and that is harder than it sounds. Most screens
// here are `position: fixed` shells, and a transform on any ancestor turns that
// ancestor into the containing block for its fixed descendants. So while a
// swipe is in flight the wrapper below is itself pinned to the viewport
// (fixed, inset 0) — its fixed children then land exactly where they already
// were — and the inner element is shifted up by the scroll offset with
// `position: relative`, which moves the flow content without becoming a
// containing block. The page looks untouched at the moment the gesture is
// claimed, and nothing about it changes while no swipe is happening.
//
// On commit the page slides off, is hidden and unpinned BEFORE navigating, so
// the next screen renders into a normal, scrollable document and the router's
// scroll restoration is not clamped by a pinned wrapper. It then fades in.
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { isStandalone } from "@/lib/standalone";
import { useBackTarget, useNavigateUp } from "@/hooks/use-back";
import { currentIndex } from "@/lib/nav-stack";
import { currentScreenBack } from "@/lib/screen-back";
import {
  CLAIM_PX,
  EDGE_ZONE_PX,
  edgeSwipeBlocked,
  resolveSwipeAction,
  rubberBand,
  shouldCommit,
  type SwipeAction,
} from "@/lib/edge-swipe";

// 250, matching --duration-fast (position-change usage) -- kept as a plain
// number, not read off the CSS var, since it also drives the setTimeout
// below that waits for SLIDE_OUT's transition to finish.
const SLIDE_MS = 250;
const SPRING_BACK = "transform var(--duration-fast) var(--ease-smooth-out)";
const SLIDE_OUT = `transform ${SLIDE_MS}ms var(--ease-smooth-out)`;
/** If the navigation never lands — a history.go() the host webview swallows,
 *  or an onIntercept confirm the user declines — show the page again. */
const NAV_TIMEOUT_MS = 700;

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function EdgeSwipeBack({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const backTarget = useBackTarget();
  const navigateUp = useNavigateUp();

  // Everything the native listeners need, read at gesture time rather than
  // captured — the listeners are attached once.
  const live = useRef({ pathname, backTarget, navigateUp, router });
  live.current = { pathname, backTarget, navigateUp, router };

  // Set while a committed swipe waits for its navigation to land.
  const pendingRef = useRef<{ from: string; timer: number } | null>(null);
  // Fades the page back in. Owned by the gesture effect, called from the
  // navigation watchers below it.
  const settleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isStandalone() || !isIOS()) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    const shade = shadeRef.current;
    if (!outer || !inner || !shade) return;

    type Gesture = {
      x0: number;
      y0: number;
      claimed: boolean;
      action: SwipeAction;
      scrollY: number;
      dx: number;
      samples: { x: number; t: number }[];
    };
    let g: Gesture | null = null;
    // True while the page is springing back or sliding off. It is still
    // pinned then, so window.scrollY reads 0 and a new gesture would capture
    // the wrong offset.
    let animating = false;

    const pin = (scrollY: number) => {
      outer.style.position = "fixed";
      outer.style.inset = "0";
      outer.style.overflow = "hidden";
      outer.style.zIndex = "1";
      outer.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.35)";
      outer.style.willChange = "transform";
      inner.style.position = "relative";
      inner.style.top = `${-scrollY}px`;
      shade.style.display = "block";
    };

    const unpin = (scrollY: number) => {
      outer.style.cssText = "";
      inner.style.cssText = "";
      shade.style.display = "none";
      shade.style.opacity = "";
      window.scrollTo(0, scrollY);
    };

    const setX = (x: number, transition = "none") => {
      outer.style.transition = transition;
      outer.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
      shade.style.transition = transition.replace("transform", "opacity");
      shade.style.opacity = String(Math.max(0, 1 - x / window.innerWidth));
    };

    const afterTransition = (fn: () => void, ms: number) => {
      let done = false;
      animating = true;
      const finish = (e?: TransitionEvent) => {
        // transitionend bubbles: a button fading inside the page is not ours.
        if (done || (e && e.target !== outer)) return;
        done = true;
        animating = false;
        outer.removeEventListener("transitionend", finish);
        fn();
      };
      outer.addEventListener("transitionend", finish);
      // transitionend does not fire when nothing actually moved.
      window.setTimeout(() => finish(), ms + 60);
    };

    const runAction = (action: SwipeAction) => {
      const { backTarget, navigateUp, router } = live.current;
      if (action === "close-overlay" || action === "history") router.history.back();
      else if (action === "screen-back") currentScreenBack()?.();
      else if (action === "up" && backTarget) navigateUp(backTarget);
    };

    const onStart = (e: TouchEvent) => {
      if (animating || pendingRef.current || e.touches.length !== 1) {
        g = null;
        return;
      }
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE_PX || edgeSwipeBlocked(live.current.pathname)) return;
      g = {
        x0: t.clientX,
        y0: t.clientY,
        claimed: false,
        action: "none",
        scrollY: window.scrollY,
        dx: 0,
        samples: [{ x: t.clientX, t: e.timeStamp }],
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!g) return;
      if (e.touches.length !== 1) {
        cancel();
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;

      if (!g.claimed) {
        // Mostly vertical: a scroll that happened to start at the edge.
        if (Math.abs(dy) > CLAIM_PX && Math.abs(dy) > dx) {
          g = null;
          return;
        }
        if (dx < CLAIM_PX || dx < Math.abs(dy) * 1.2) return;
        g.claimed = true;
        g.action = resolveSwipeAction({
          pathname: live.current.pathname,
          overlayOpen:
            (window.history.state as { __oakOverlay?: boolean } | null)?.__oakOverlay === true,
          hasScreenBack: currentScreenBack() !== null,
          hasHierarchyParent: live.current.backTarget !== null,
          stackIndex: currentIndex(),
        });
        pin(g.scrollY);
      }

      // Ours now: no page scroll, no carousel, no pull-to-refresh underneath.
      if (e.cancelable) e.preventDefault();
      g.dx = Math.max(0, dx);
      g.samples.push({ x: t.clientX, t: e.timeStamp });
      if (g.samples.length > 5) g.samples.shift();
      setX(g.action === "none" ? rubberBand(g.dx) : g.dx);
    };

    const cancel = () => {
      if (!g) return;
      const { claimed, scrollY } = g;
      g = null;
      if (!claimed) return;
      setX(0, SPRING_BACK);
      afterTransition(() => unpin(scrollY), 260);
    };

    const onEnd = (e: TouchEvent) => {
      if (!g) return;
      if (!g.claimed) {
        g = null;
        return;
      }
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      if (g.action === "none" || !shouldCommit(g.dx, velocity, window.innerWidth)) {
        cancel();
        return;
      }
      e.preventDefault(); // no synthetic click on whatever is under the finger

      const { action, scrollY } = g;
      g = null;
      setX(window.innerWidth, SLIDE_OUT);
      afterTransition(() => {
        // Hidden, then unpinned, then navigated — see the file header.
        outer.style.opacity = "0";
        outer.style.transition = "none";
        outer.style.transform = "";
        outer.style.position = "";
        outer.style.inset = "";
        outer.style.overflow = "";
        outer.style.boxShadow = "";
        inner.style.cssText = "";
        shade.style.display = "none";
        window.scrollTo(0, scrollY);

        const from = window.location.href;
        const timer = window.setTimeout(() => settle(), NAV_TIMEOUT_MS);
        pendingRef.current = { from, timer };
        runAction(action);
      }, SLIDE_MS);
    };

    // Show whatever is now on screen — the next page, or the same one if the
    // navigation never happened.
    const settle = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      outer.style.transition = "opacity 180ms ease-out";
      outer.style.opacity = "1";
      afterTransition(() => {
        outer.style.cssText = "";
      }, 180);
    };
    settleRef.current = settle;

    const opts = { capture: true, passive: false } as const;
    window.addEventListener("touchstart", onStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", onEnd, opts);
    window.addEventListener("touchcancel", cancel, { capture: true });
    return () => {
      window.removeEventListener("touchstart", onStart, { capture: true });
      window.removeEventListener("touchmove", onMove, { capture: true });
      window.removeEventListener("touchend", onEnd, { capture: true });
      window.removeEventListener("touchcancel", cancel, { capture: true });
      settleRef.current = null;
    };
  }, []);

  // The navigation landed: fade the new screen in. The href rather than the
  // pathname, so a search-only return (?checklist=true) counts too.
  const href = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && pending.from !== window.location.href) settleRef.current?.();
  }, [href]);
  // Closing a sheet pops history without changing the router's href.
  useEffect(() => {
    const onPop = () => {
      if (pendingRef.current) window.setTimeout(() => settleRef.current?.(), 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      {/* What shows behind the page as it slides away. There is no previous
          screen to reveal — it isn't rendered — so this is a dim, and it
          lightens as the page travels. */}
      <div
        ref={shadeRef}
        aria-hidden
        style={{
          display: "none",
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />
      <div ref={outerRef}>
        <div ref={innerRef}>{children}</div>
      </div>
    </>
  );
}
