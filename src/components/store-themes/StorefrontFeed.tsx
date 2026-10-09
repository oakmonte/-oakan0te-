import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { PostFeed, type ActivePost } from "@/components/feed/PostFeed";
import { ListedItemsPage } from "@/components/ExploreFeedOverlay";

type Tab = "for-you" | "listed-items";
const TABS: Tab[] = ["for-you", "listed-items"];

// Same settle as the app's other pagers: quick, no bounce.
const SETTLE = { type: "spring", stiffness: 420, damping: 40 } as const;

/** The storefront's Home tab: the store's own posts as a full-screen feed,
 *  with For you and Listed items at the top. Listed items is whatever's
 *  linked to the post you were just watching.
 *
 *  A two-page pager: both pages sit side by side and the track follows the
 *  finger left/right, then settles on one. Up/down is the feed's own native
 *  scroll -- the track only claims horizontal drags (direction-locked), so a
 *  vertical swipe never nudges it sideways and a sideways one never scrolls. */
export function StorefrontFeed({
  ownerId,
  storePicture,
}: {
  ownerId: string;
  storePicture: string | null;
}) {
  const [tab, setTab] = useState<Tab>("for-you");
  // Held here so Listed items knows which post you were on.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const index = TABS.indexOf(tab);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Settle on the current page whenever it (or the width) changes.
  useEffect(() => {
    if (!width) return;
    const controls = animate(x, -index * width, SETTLE);
    return () => controls.stop();
  }, [index, width, x]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    // A flick counts as much as a long drag.
    const swipe = info.offset.x + info.velocity.x * 0.2;
    const next = swipe < -width * 0.25 ? index + 1 : swipe > width * 0.25 ? index - 1 : index;
    const clamped = Math.max(0, Math.min(TABS.length - 1, next));
    if (clamped === index) void animate(x, -index * width, SETTLE);
    else setTab(TABS[clamped]);
  }

  const items = activePost?.tags ?? [];

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-x-0 top-0 z-20 flex justify-center gap-6 pb-2 text-[14px] font-medium text-white/55"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        {(
          [
            ["for-you", "For you"],
            ["listed-items", "Listed items"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap pb-1 drop-shadow transition-colors duration-200 ${
              tab === key ? "font-semibold text-white underline underline-offset-4" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -(TABS.length - 1) * width, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        className="flex h-full"
        style={{ x, width: `${TABS.length * 100}%`, touchAction: "pan-y" }}
      >
        <div className="h-full" style={{ width: `${100 / TABS.length}%` }}>
          <PostFeed
            mode="embedded"
            scope={{ type: "author", userId: ownerId }}
            onActivePost={setActivePost}
            onSwipePastEnd={() => setTab("listed-items")}
            storePicture={storePicture}
          />
        </div>
        <div className="h-full" style={{ width: `${100 / TABS.length}%` }}>
          {items.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center px-10 text-center">
              <p className="text-[15px] font-semibold text-white/70">No linked products</p>
            </div>
          ) : (
            <div className="h-full w-full pt-14">
              <ListedItemsPage items={items} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
