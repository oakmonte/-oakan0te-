import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, type MotionValue, type PanInfo } from "framer-motion";

// Same curve the store sheet uses, so the two motions on this page agree.
// Slightly under critical damping: settles in ~300ms with no wobble.
const SPRING = { type: "spring" as const, stiffness: 500, damping: 42, mass: 1 };

// A flick this fast pages even if the finger barely travelled — without it, a
// fast-but-short swipe (the normal way people flick between tabs) falls back
// to the distance test and springs back, which reads as "swiping doesn't
// work". Gated on the gesture being horizontal, see handleDragEnd.
const FLICK_VELOCITY = 600;
const DISTANCE_RATIO = 0.25;

/** Horizontal pager for the profile tab strips — the real thing, not a
 *  crossfade behind a fake drag.
 *
 *  What this replaces, and why: the previous version pinned the draggable
 *  node with `dragConstraints={{left:0,right:0}}` and `dragElastic={0.12}`,
 *  so a full-width swipe moved the content about a finger's width and sprang
 *  back, and the actual tab change was an `AnimatePresence mode="wait"`
 *  crossfade — exit (150ms) *then* enter (150ms), with the panel unmounted
 *  and remounted in between. That's why swiping felt dead and every tab
 *  change refetched.
 *
 *  Here every page is laid out side by side in one flex track that is
 *  translated by whole page widths. Dragging inside the range moves the
 *  track 1:1 with the finger; `dragElastic` only ever applies past the first
 *  and last page, which is the rubber-band you want at the ends. Pages stay
 *  mounted, so paging back is instant and nothing refetches.
 *
 *  `x` is exposed so the caller can drive its tab indicator from the same
 *  motion value — an indicator that only moves after release is the giveaway
 *  that a pager isn't really tracking the finger. */
export function TabPager({
  index,
  count,
  onIndexChange,
  x: externalX,
  onPageWidth,
  minHeight,
  children,
}: {
  index: number;
  count: number;
  onIndexChange: (next: number) => void;
  /** Optional shared motion value (px offset of the track) for a caller that
   *  wants to animate its own chrome in step with the drag. */
  x?: MotionValue<number>;
  onPageWidth?: (width: number) => void;
  /** CSS min-height for the swipeable viewport. Without it, the drag surface
   *  is exactly as tall as the active page's own content -- fine for a posts
   *  grid that's always tall, but a page with a short or empty list leaves
   *  most of the screen below it un-swipeable. Paired with the measured
   *  `height` below, whichever is larger wins. */
  minHeight?: string | number;
  /** Exactly `count` nodes, one per page, in tab order. */
  children: ReactNode[];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heights = useRef<number[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const internalX = useMotionValue(0);
  const x = externalX ?? internalX;
  const settled = useRef(false);
  const horizontal = useRef(false);

  // Layout effect, not a passive one: measured after paint, the track sat at
  // x=0 for a frame and then animated across from the Posts page every time
  // this mounted on any other tab (e.g. swiping out of the store sheet).
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setPageWidth(w);
      onPageWidth?.(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onPageWidth]);

  // Settle on the active page. The first positioning (and any resize) is set
  // instantly — only a genuine tab change animates.
  useLayoutEffect(() => {
    if (!pageWidth) return;
    const target = -index * pageWidth;
    if (!settled.current) {
      settled.current = true;
      x.set(target);
      return;
    }
    const controls = animate(x, target, SPRING);
    return () => controls.stop();
  }, [index, pageWidth, x]);

  // Height follows the active page, but never shrinks mid-transition: the
  // viewport clips, so collapsing to a short incoming page while the slide is
  // still running cuts it off and jerks everything below it.
  useEffect(() => {
    const el = pageRefs.current[index];
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      heights.current[index] = h;
      setHeight((prev) => (prev !== undefined && h < prev ? prev : h));
    };
    update();
    const settle = setTimeout(() => setHeight(heights.current[index]), 320);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(settle);
    };
  }, [index]);

  // Focusing something on an offscreen page makes the browser scroll this
  // clipped box sideways, and a transform-based pager never puts it back —
  // every page ends up permanently offset. `inert` below prevents most of it;
  // this is the backstop.
  function handleScroll() {
    const el = viewportRef.current;
    if (el && el.scrollLeft !== 0) el.scrollLeft = 0;
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (!pageWidth) return;
    const { offset, velocity } = info;
    // The browser fires pointercancel when it claims a gesture as a vertical
    // scroll, and framer routes that to drag-end with the x velocity still
    // accumulated — so without this gate, flicking diagonally down the posts
    // grid could throw you onto another tab.
    const isHorizontal = Math.abs(offset.x) > Math.abs(offset.y) && Math.abs(offset.x) > 8;
    let next = index;
    if (isHorizontal) {
      if (offset.x < -pageWidth * DISTANCE_RATIO || velocity.x < -FLICK_VELOCITY) next = index + 1;
      else if (offset.x > pageWidth * DISTANCE_RATIO || velocity.x > FLICK_VELOCITY)
        next = index - 1;
    }
    next = Math.max(0, Math.min(count - 1, next));

    // Always animate, and hand the gesture's own velocity to the spring so a
    // flick carries through instead of restarting from rest. When `next`
    // equals the current index nothing re-renders, so the effect above
    // wouldn't fire and the track would sit wherever the finger dropped it.
    animate(x, -next * pageWidth, { ...SPRING, velocity: velocity.x });
    if (next !== index) onIndexChange(next);
  }

  return (
    <div
      ref={viewportRef}
      className="overflow-hidden"
      style={{ height, minHeight }}
      onScroll={handleScroll}
    >
      <motion.div
        // h-full, not just items-start sizing to content: the outer viewport
        // can be taller than the active page (see minHeight above), and drag
        // is bound to THIS element -- if it only sized to its own content,
        // the empty space below a short page would have nothing draggable
        // under the finger at all, which is exactly what made swiping only
        // work right over the visible rows.
        className="flex h-full items-start"
        style={{ x }}
        drag="x"
        dragDirectionLock
        onDirectionLock={(axis) => {
          horizontal.current = axis === "x";
        }}
        dragConstraints={{ left: -Math.max(0, count - 1) * pageWidth, right: 0 }}
        dragElastic={0.3}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
      >
        {children.map((page, i) => (
          <div
            key={i}
            ref={(el) => {
              pageRefs.current[i] = el;
            }}
            className="w-full shrink-0"
            // inert, not pointer-events + aria-hidden: offscreen pages were
            // still keyboard-focusable (grid tiles, the empty states' upload
            // inputs), and aria-hidden over focusable content is its own
            // violation.
            inert={i !== index}
          >
            {page}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
